import type { AmbientLight, PointLight, SpotLight } from "@/types/lighting";
import { getRandomHexColor, getRandomVector3 } from "@/utils/random";
import { create } from "zustand";

interface LightingState {
  ambientLight: AmbientLight;
  setAmbientLight: (props: Partial<AmbientLight>) => void;

  pointLights: PointLight[];
  setPointLightsAmount: (count: number) => void;
  updatePointLight: (index: number, props: Partial<PointLight>) => void;

  spotLights: SpotLight[];
  setSpotLightsAmount: (count: number) => void;
  updateSpotLight: (index: number, props: Partial<SpotLight>) => void;
}

export const useLightStore = create<LightingState>((set) => ({
  ambientLight: {
    type: "ambient",
    enabled: true,
    intensity: Math.PI / 2,
    color: "#ffffff",
  },
  setAmbientLight: (props: Partial<AmbientLight>) =>
    set((state) => ({
      ...state,
      ambientLight: { ...state.ambientLight, ...props },
    })),

  pointLights: [],
  setPointLightsAmount: (count: number) =>
    set((state) => {
      if (count <= 0) {
        return { ...state, pointLights: [] };
      }

      if (count > state.pointLights.length) {
        return {
          ...state,
          pointLights: [
            ...state.pointLights,
            ...Array(count - state.pointLights.length).fill({
              type: "point",
              enabled: true,
              intensity: 20,
              color: getRandomHexColor(),
              decay: 0,
              distance: 150,
              position: getRandomVector3(25, 50, {
                z: 10,
                randomizeSign: true,
              }),
              power: 100,
            } as PointLight),
          ],
        };
      }

      return { ...state, pointLights: state.pointLights.slice(0, count) };
    }),
  updatePointLight: (index: number, props: Partial<PointLight>) =>
    set((state) => {
      if (index < 0 || index >= state.pointLights.length) {
        return state;
      }
      return {
        ...state,
        pointLights: [
          ...state.pointLights.slice(0, index),
          { ...state.pointLights[index], ...props },
          ...state.pointLights.slice(index + 1),
        ],
      };
    }),

  spotLights: [],
  setSpotLightsAmount: (count: number) =>
    set((state) => {
      if (count <= 0) {
        return { ...state, spotLights: [] };
      }

      if (count > state.spotLights.length) {
        return {
          ...state,
          spotLights: [
            ...state.spotLights,
            ...Array(count - state.spotLights.length).fill({
              type: "spot",
              enabled: true,
              intensity: Math.PI / 2,
              color: getRandomHexColor(),
              decay: 0,
              distance: 100,
              position: getRandomVector3(25, 50, {
                z: 10,
                randomizeSign: true,
              }),
              angle: Math.PI / 4,
              penumbra: 0.1,
              castShadow: true,
              power: 100,
            } as SpotLight),
          ],
        };
      }

      return { ...state, spotLights: state.spotLights.slice(0, count) };
    }),
  updateSpotLight: (index: number, props: Partial<SpotLight>) =>
    set((state) => {
      if (index < 0 || index >= state.spotLights.length) {
        return state;
      }
      return {
        ...state,
        spotLights: [
          ...state.spotLights.slice(0, index),
          { ...state.spotLights[index], ...props },
          ...state.spotLights.slice(index + 1),
        ],
      };
    }),
}));
