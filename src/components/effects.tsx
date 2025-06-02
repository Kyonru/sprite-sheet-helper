import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Glitch,
  Noise,
  Outline,
  Pixelation,
  Vignette,
  type GlitchProps,
  type OutlineProps,
} from "@react-three/postprocessing";
import { useEffectsStore } from "@/store/effects";
import { useModelStore } from "@/store/model";

export const PostProcessingEffects = () => {
  const pixelation = useEffectsStore((state) => state.pixelation);
  const glitch = useEffectsStore((state) => state.glitch);
  const bloom = useEffectsStore((state) => state.bloom);
  const depthOfField = useEffectsStore((state) => state.depthOfField);
  const noise = useEffectsStore((state) => state.noise);
  const vignette = useEffectsStore((state) => state.vignette);
  const outline = useEffectsStore((state) => state.outline);
  const modelRef = useModelStore((state) => state.ref);
  const setComposer = useEffectsStore((state) => state.setComposer);

  return (
    <EffectComposer
      // enableNormalPass
      // depthBuffer
      multisampling={8}
      autoClear={false}
      ref={(ref) => {
        setComposer(ref);
      }}
    >
      <>
        {depthOfField.enabled && <DepthOfField {...depthOfField} />}
        {bloom.enabled && <Bloom {...bloom} />}
        {noise.enabled && <Noise {...noise} />}
        {vignette.enabled && <Vignette {...vignette} />}
        {glitch.enabled && <Glitch {...(glitch as unknown as GlitchProps)} />}
        {pixelation.enabled && <Pixelation {...pixelation} />}
        {outline.enabled && (
          <Outline
            {...(outline as unknown as OutlineProps)}
            selection={modelRef ? [modelRef] : []}
          />
        )}
      </>
    </EffectComposer>
  );
};
