import {
  GlitchMode,
  BlendFunction,
  Resizer,
  KernelSize,
  Resolution,
} from "postprocessing";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Glitch,
  Noise,
  Outline,
  Pixelation,
  Vignette,
} from "@react-three/postprocessing";

export const PostProcessingEffects = () => {
  return (
    <EffectComposer>
      <DepthOfField
        focusDistance={0}
        focalLength={0.02}
        bokehScale={2}
        height={480}
      />
      <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} />
      <Noise opacity={0.02} />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
      <Glitch
        delay={[1.5, 3.5]} // min and max glitch delay
        duration={[0.6, 1.0]} // min and max glitch duration
        strength={[0.3, 1.0]} // min and max glitch strength
        mode={GlitchMode.SPORADIC} // glitch mode
        active // turn on/off the effect (switches between "mode" prop and GlitchMode.DISABLED)
        ratio={0.85} // Threshold for strong glitches, 0 - no weak glitches, 1 - no strong glitches.
      />
      <Pixelation
        granularity={5} // pixel granularity
      />

      <Outline
        selection={[]} // selection of objects that will be outlined
        selectionLayer={10} // selection layer
        blendFunction={BlendFunction.SCREEN} // set this to BlendFunction.ALPHA for dark outlines
        patternTexture={null} // a pattern texture
        edgeStrength={2.5} // the edge strength
        pulseSpeed={0.0} // a pulse speed. A value of zero disables the pulse effect
        visibleEdgeColor={0xffffff} // the color of visible edges
        hiddenEdgeColor={0x22090a} // the color of hidden edges
        width={Resolution.AUTO_SIZE} // render width
        height={Resolution.AUTO_SIZE} // render height
        kernelSize={KernelSize.LARGE} // blur kernel size
        blur={false} // whether the outline should be blurred
        xRay={true} // indicates whether X-Ray outlines are enabled
      />
    </EffectComposer>
  );
};
