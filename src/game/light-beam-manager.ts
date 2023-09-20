import * as THREE from "three";
import { EventListener } from "../listeners/event-listener";
import { GameStore } from "./game-store";
import { Road } from "./model/road";
import { randomRange } from "../utils/utils";

interface Beam {
  light: THREE.SpotLight;
  roadId: string;
}

export class LightBeamManager {
  private spawnTimer = 0;
  private spawnAt = 1;
  private beamLifetime = 1;
  private readonly beamLifetimeDefault = 1;
  private activeBeam?: Beam;
  private lightPositions = new Map<string, THREE.Vector3[]>();

  constructor(private gameStore: GameStore, private events: EventListener) {
    events.on("street-light-positions", this.onCreateStreetLights);
    events.on("road-removed", this.onRoadRemoved);
  }

  update(dt: number) {
    if (this.activeBeam) {
      this.trackBeam(dt);
    } else {
      this.trackSpawn(dt);
    }
  }

  private trackBeam(dt: number) {
    this.beamLifetime -= dt;

    if (this.beamLifetime <= 0) {
      this.removeBeam();
      this.spawnAt = randomRange(1, 2);
      this.spawnTimer = 0;
    }
  }

  private removeBeam() {
    if (!this.activeBeam) {
      return;
    }

    const { scene } = this.gameStore;

    scene.remove(this.activeBeam.light, this.activeBeam.light.target);
    this.activeBeam = undefined;
  }

  private trackSpawn(dt: number) {
    this.spawnTimer += dt;

    if (this.spawnTimer >= this.spawnAt) {
      this.createBeam();
      this.beamLifetime = this.beamLifetimeDefault;
    }
  }

  private createBeam() {
    const { scene } = this.gameStore;

    // Get a random road for light to appear on
    const road = this.getRandomRoad();

    // Get a random light position for this road
    const position = this.getRandomLightPosition(road.id);

    // Create a light here
    const light = this.getBeamSpotlight(position);
    scene.add(light, light.target);

    // Keep track for later removal
    this.activeBeam = {
      light,
      roadId: road.id,
    };
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

  private getBeamSpotlight(position: THREE.Vector3) {
    const light = new THREE.SpotLight(0xff0000, 5);
    light.distance = 12;
    light.angle = Math.PI / 5;
    light.penumbra = 0.1;
    light.decay = 0;

    light.position.copy(position);
    light.position.y = 7.5;
    light.target.position.copy(position);
    light.target.position.y = 0;

    return light;
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
    if (this.activeBeam?.roadId === road.id) {
      // Stop it
      this.removeBeam();
    }
  };
}
