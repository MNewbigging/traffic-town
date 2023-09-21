import * as THREE from "three";
import { Bounce, Linear, gsap } from "gsap";
import { EventListener } from "../listeners/event-listener";
import { GameStore } from "./game-store";
import { Road } from "./model/road";
import { randomRange } from "../utils/utils";

export class LightBeamManager {
  private spawnTimer = 0;
  private spawnAt = 1;
  private beamLifetime = 1;
  private readonly beamLifetimeDuration = 3;
  private readonly beamFlickerOnDuration = 1.2;
  private readonly beamFinishDuration = 1;
  private spotLight = new THREE.SpotLight(0xff0000, 0);
  private activeRoadId?: string;
  private lightPositions = new Map<string, THREE.Vector3[]>();

  constructor(private gameStore: GameStore, private events: EventListener) {
    events.on("street-light-positions", this.onCreateStreetLights);
    events.on("road-removed", this.onRoadRemoved);

    // Setup spotlight properties
    this.spotLight.distance = 12;
    this.spotLight.angle = Math.PI / 5;
    this.spotLight.penumbra = 0.1;
    this.spotLight.decay = 0;

    // Add to scene once
    this.gameStore.scene.add(this.spotLight, this.spotLight.target);
  }

  update(dt: number) {
    if (this.activeRoadId) {
      this.trackBeam(dt);
    } else {
      this.trackSpawn(dt);
    }
  }

  private trackBeam(dt: number) {
    this.beamLifetime -= dt;

    if (this.beamLifetime <= 0) {
      this.removeBeam();
    }
  }

  private removeBeam() {
    if (!this.activeRoadId) {
      return;
    }

    // Hide the spotlight
    this.beamFinish();
    this.activeRoadId = undefined;

    // Then set spawn timer values
    const min = this.beamFinishDuration + 1;
    const max = min + 2; // replace with prop later
    this.spawnAt = randomRange(min, max);
    this.spawnTimer = 0;
  }

  private beamFinish() {
    const tl = gsap.timeline();
    tl.to(this.spotLight, {
      intensity: 0,
      angle: Math.PI / 8,
      duration: this.beamFinishDuration,
      ease: Linear.easeIn,
    });
  }

  private trackSpawn(dt: number) {
    this.spawnTimer += dt;

    if (this.spawnTimer >= this.spawnAt) {
      this.createBeam();
    }
  }

  private createBeam() {
    // Get a random road for light to appear on
    const road = this.getRandomRoad();

    // Get a random light position for this road
    const position = this.getRandomLightPosition(road.id);

    // Show the light here
    this.showBeamSpotlight(position);

    // Set lifetime of the beam
    this.beamLifetime = this.beamFlickerOnDuration + this.beamLifetimeDuration;

    // Keep track for later removal
    this.activeRoadId = road.id;
  }

  private getRandomRoad() {
    const { player, roads } = this.gameStore;

    // Choose between this or next road
    const currentRoadIdx = this.gameStore.getCurrentRoadIndexFor(
      player.object.position.z
    );
    const nextRoadIdx = currentRoadIdx + 1;

    // Pick one at random
    const randomRoadIdx = Math.random() < 0.5 ? currentRoadIdx : nextRoadIdx;

    return roads[randomRoadIdx];
  }

  private getRandomLightPosition(roadId: string) {
    const positions = this.lightPositions.get(roadId);
    if (!positions) {
      return new THREE.Vector3();
    }

    // Pick a random light position
    const rnd = Math.floor(Math.random() * positions.length);
    const position = positions[rnd];

    return position;
  }

  private showBeamSpotlight(position: THREE.Vector3) {
    // Assign to new position
    this.spotLight.position.copy(position);
    this.spotLight.position.y = 7.5;
    this.spotLight.target.position.copy(position);
    this.spotLight.target.position.y = 0;

    // Show the spotlight
    this.beamFlickerOn();
  }

  private beamFlickerOn() {
    const tl = gsap.timeline();
    tl.to(this.spotLight, {
      intensity: 5,
      angle: Math.PI / 5,
      duration: this.beamFlickerOnDuration,
      ease: Bounce.easeIn,
    });
  }

  private onCreateStreetLights = (data: {
    roadId: string;
    positions: THREE.Vector3[];
  }) => {
    this.lightPositions.set(data.roadId, data.positions);
  };

  private onRoadRemoved = (road: Road) => {
    this.lightPositions.delete(road.id);

    // If there was an active beam on this road
    if (this.activeRoadId === road.id) {
      // Stop it
      this.removeBeam();
    }
  };
}
