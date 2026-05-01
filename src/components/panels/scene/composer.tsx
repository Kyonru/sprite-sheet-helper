import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  Glitch,
  Noise,
  Outline,
  Pixelation,
  Vignette,
  DotScreen,
  HueSaturation,
  Scanline,
  Sepia,
  BrightnessContrast,
  ColorAverage,
  ColorDepth,
  TiltShift,
  TiltShift2,
  ASCII,
  Grid,
  ToneMapping,
} from "@react-three/postprocessing";
import { useEffectsStore } from "@/store/next/effects";
import { useSceneStore } from "./store";
import { PaletteEffect } from "./custom-effects.tsx/palette";
import { DitherEffect } from "./custom-effects.tsx/dither";
import { CustomShaderEffect } from "./custom-effects.tsx/custom-shader";
import { SmearEffect } from "./custom-effects.tsx/smear";

import { useRefsStore } from "@/store/next/refs";
import { useMemo } from "react";
import * as THREE from "three";
import { Vector2 } from "three";
import type { EffectComponent } from "@/types/effects";

function EffectNode({ effect }: { effect: EffectComponent }) {
  const refs = useRefsStore((state) => state.refs);

  const selection = useMemo(() => {
    const objects: THREE.Object3D[] = [];

    const entries = Object.entries(refs);

    for (const [, ref] of entries) {
      if (ref.type !== "model") continue;
      objects.push(ref.current);
    }

    return objects;
  }, [refs]);

  if (!effect.enabled) return null;

  switch (effect.type) {
    case "pixelation":
      return <Pixelation granularity={effect.granularity} />;

    case "glitch":
      return (
        <Glitch
          delay={new Vector2(...effect.delay)}
          duration={new Vector2(...effect.duration)}
          strength={new Vector2(...effect.strength)}
          dtSize={effect.dtSize}
          columns={effect.columns}
          mode={effect.mode}
          ratio={effect.ratio}
        />
      );

    case "bloom":
      return (
        <Bloom
          blendFunction={effect.blendFunction}
          luminanceThreshold={effect.luminanceThreshold}
          luminanceSmoothing={effect.luminanceSmoothing}
          intensity={effect.intensity}
          mipmapBlur={effect.mipmapBlur}
          levels={effect.levels}
          radius={effect.radius}
        />
      );

    case "depthOfField":
      return (
        <DepthOfField
          blendFunction={effect.blendFunction}
          focusDistance={effect.focusDistance}
          focusRange={effect.focusRange}
          worldFocusDistance={effect.worldFocusDistance}
          worldFocusRange={effect.worldFocusRange}
          bokehScale={effect.bokehScale}
          resolutionScale={effect.resolutionScale}
          resolutionX={effect.resolutionX}
          resolutionY={effect.resolutionY}
        />
      );

    case "noise":
      return (
        <Noise
          premultiply={effect.premultiply}
          blendFunction={effect.blendFunction}
        />
      );

    case "vignette":
      return (
        <Vignette
          technique={effect.technique}
          offset={effect.offset}
          darkness={effect.darkness}
        />
      );

    case "outline":
      return (
        <Outline
          blendFunction={effect.blendFunction}
          // TODO: Add global selectionLayer support
          selectionLayer={0}
          edgeStrength={effect.edgeStrength}
          pulseSpeed={effect.pulseSpeed}
          visibleEdgeColor={effect.visibleEdgeColor as unknown as number}
          hiddenEdgeColor={effect.hiddenEdgeColor as unknown as number}
          kernelSize={effect.kernelSize}
          blur={effect.blur}
          xRay={effect.xRay}
          multisampling={effect.multisampling}
          resolutionScale={effect.resolutionScale}
          resolutionX={effect.resolutionX}
          resolutionY={effect.resolutionY}
          selection={selection}
        />
      );

    case "ascii":
      return (
        <ASCII
          font={effect.font}
          characters={effect.characters}
          invert={effect.invert}
          fontSize={effect.fontSize}
          cellSize={effect.cellSize}
          color={effect.color}
        />
      );

    case "brightnessContrast":
      return (
        <BrightnessContrast
          brightness={effect.brightness}
          contrast={effect.contrast}
          blendFunction={effect.blendFunction}
        />
      );

    case "chromaticAberration":
      return (
        <ChromaticAberration
          radialModulation={effect.radialModulation}
          modulationOffset={effect.modulationOffset}
          offset={effect.offset}
          blendFunction={effect.blendFunction}
        />
      );

    case "colorAverage":
      return <ColorAverage blendFunction={effect.blendFunction} />;

    case "colorDepth":
      return (
        <ColorDepth bits={effect.bits} blendFunction={effect.blendFunction} />
      );

    case "depth":
      return (
        <DepthOfField /> // swap for actual Depth effect if available
      );

    case "tiltShift":
      return (
        <TiltShift
          blendFunction={effect.blendFunction}
          offset={effect.offset}
          rotation={effect.rotation}
          focusArea={effect.focusArea}
          feather={effect.feather}
          kernelSize={effect.kernelSize}
          resolutionScale={effect.resolutionScale}
          resolutionX={effect.resolutionX}
          resolutionY={effect.resolutionY}
        />
      );

    case "tiltShift2":
      return (
        <TiltShift2
          blendFunction={effect.blendFunction}
          blur={effect.blur}
          taper={effect.taper}
          samples={effect.samples}
        />
      );

    case "dotScreen":
      return (
        <DotScreen
          blendFunction={effect.blendFunction}
          angle={effect.angle}
          scale={effect.scale}
          selection={selection}
        />
      );

    case "hueSaturation":
      return (
        <HueSaturation
          hue={effect.hue}
          saturation={effect.saturation}
          blendFunction={effect.blendFunction}
        />
      );

    case "scanline":
      return (
        <Scanline
          blendFunction={effect.blendFunction}
          density={effect.density}
        />
      );

    case "sepia":
      return (
        <Sepia
          intensity={effect.intensity}
          blendFunction={effect.blendFunction}
        />
      );
    case "palette":
      return <PaletteEffect palette={effect.palette} />;

    case "dither":
      return (
        <DitherEffect
          ditherScale={effect.ditherScale}
          ditherStrength={effect.ditherStrength}
        />
      );

    case "tonemap":
      return (
        <ToneMapping
          blendFunction={effect.blendFunction}
          adaptive={effect.adaptive}
          resolution={effect.resolution} // texture resolution of the luminance map
          middleGrey={effect.middleGrey} // middle grey factor
          maxLuminance={effect.maxLuminance} // maximum luminance
          averageLuminance={effect.averageLuminance} // average luminance
          adaptationRate={effect.adaptationRate} // luminance adaptation rate
        />
      );

    case "customShader":
      return (
        <CustomShaderEffect
          fragmentShader={effect.fragmentShader}
          onError={(err) => {
            if (err) console.error("[CustomShaderEffect]", err);
          }}
        />
      );

    case "grid":
      return <Grid {...effect} />;

    case "smear":
      return (
        <SmearEffect
          enabled
          damp={effect.damp}
          tint={effect.tint}
          legacy={effect.legacy}
        />
      );

    default:
      return null;
  }
}

export function PostProcessingEffectsComposer() {
  const effects = useEffectsStore((state) => state.effects);
  const setComposer = useSceneStore((state) => state.setComposer);

  return (
    <EffectComposer
      multisampling={8}
      autoClear={false}
      ref={(ref) => {
        setComposer(ref);
      }}
    >
      {Object.entries(effects).map(([uuid, effect]) => (
        <EffectNode key={uuid} effect={effect} />
      ))}
    </EffectComposer>
  );
}
