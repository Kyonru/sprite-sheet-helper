import type { AmbientLight, PointLight, SpotLight } from "@/types/lighting";
import { getRandomHexColor, getRandomVector3 } from "@/utils/random";
import { create } from "zustand";

interface LightingState {
  ambientLight: AmbientLight;
  setAmbientLight: (props: Partial<AmbientLight>) => void;

  pointLights: PointLight[];
  setPointLightsAmount: (count: number) => void;
  updatePointLight: (index: number, props: Partial<PointLight>) => void;
  pointLightsUIState: Record<number, <T>(uiState: T) => void>;
  setPointLightsUIStateFunction: (
    id: number,
    fn: <T>(uiState: T) => void
  ) => void;

  spotLights: SpotLight[];
  setSpotLightsAmount: (count: number) => void;
  updateSpotLight: (index: number, props: Partial<SpotLight>) => void;
  spotLightsUIState: Record<number, <T>(uiState: T) => void>;
  setSpotLightsUIStateFunction: (
    id: number,
    fn: <T>(uiState: T) => void
  ) => void;
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
              intensity: 10,
              color: getRandomHexColor(),
              decay: 0,
              distance: 15,
              position: getRandomVector3(3, 5, {
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
              intensity: 10,
              color: getRandomHexColor(),
              decay: 0,
              distance: 50,
              lookAtObject: true,
              rotation: [0, 0, 0],
              position: getRandomVector3(3, 5, {
                randomizeSign: true,
              }),
              angle: 0.1,
              penumbra: 0.1,
              castShadow: true,
              power: 100,
              transform: "translate",
              direction: [0, 0, 0],
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
  pointLightsUIState: {},
  setPointLightsUIStateFunction: (id: number, fn: <T>(uiState: T) => void) =>
    set((state) => ({
      ...state,
      pointLightsUIState: {
        ...state.pointLightsUIState,
        [id]: fn,
      },
    })),

  spotLightsUIState: {},
  setSpotLightsUIStateFunction: (id: number, fn: <T>(uiState: T) => void) =>
    set((state) => ({
      ...state,
      spotLightsUIState: {
        ...state.spotLightsUIState,
        [id]: fn,
      },
    })),
}));
