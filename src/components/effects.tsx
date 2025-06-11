import {
  ASCII,
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  ColorAverage,
  ColorDepth,
  Depth,
  DepthOfField,
  DotScreen,
  EffectComposer,
  Glitch,
  Grid,
  HueSaturation,
  Noise,
  Outline,
  Pixelation,
  Scanline,
  Sepia,
  TiltShift,
  TiltShift2,
  Vignette,
  type GlitchProps,
  type OutlineProps,
} from "@react-three/postprocessing";
import { useEffectsStore } from "@/store/effects";
import { useModelStore } from "@/store/model";
import { useExportOptionsStore } from "@/store/export";
import { useEditorStore } from "@/store/editor";

export const PostProcessingEffects = () => {
  const pixelation = useEffectsStore((state) => state.pixelation);
  const glitch = useEffectsStore((state) => state.glitch);
  const bloom = useEffectsStore((state) => state.bloom);
  const depthOfField = useEffectsStore((state) => state.depthOfField);
  const noise = useEffectsStore((state) => state.noise);
  const vignette = useEffectsStore((state) => state.vignette);
  const outline = useEffectsStore((state) => state.outline);
  const ascii = useEffectsStore((state) => state.ascii);
  const brightnessContrast = useEffectsStore(
    (state) => state.brightnessContrast
  );
  const chromaticAberration = useEffectsStore(
    (state) => state.chromaticAberration
  );
  const colorAverage = useEffectsStore((state) => state.colorAverage);
  const colorDepth = useEffectsStore((state) => state.colorDepth);
  const depth = useEffectsStore((state) => state.depth);
  const tiltShift = useEffectsStore((state) => state.tiltShift);
  const tiltShift2 = useEffectsStore((state) => state.tiltShift2);
  const dotScreen = useEffectsStore((state) => state.dotScreen);
  const hueSaturation = useEffectsStore((state) => state.hueSaturation);
  const scanline = useEffectsStore((state) => state.scanline);
  const sepia = useEffectsStore((state) => state.sepia);

  const modelRef = useModelStore((state) => state.ref);
  const setComposer = useEffectsStore((state) => state.setComposer);

  const exportWidth = useExportOptionsStore((state) => state.exportWidth);
  const previewWidth = useExportOptionsStore((state) => state.width);

  const preview = useExportOptionsStore((state) => state.preview);
  const showEditor = useEditorStore((state) => state.showEditor);

  let pixelDensity = 1;

  if (window.devicePixelRatio > 1) {
    pixelDensity = 1 / window.devicePixelRatio;
  }

  const baseWorldSize = 8 * pixelDensity;
  const scale = (baseWorldSize / previewWidth) * exportWidth;

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
        {pixelation.enabled && <Pixelation {...pixelation} />}
        {noise.enabled && <Noise {...noise} />}
        {outline.enabled && (
          // Add Texture support
          <Outline
            {...(outline as unknown as OutlineProps)}
            selection={modelRef ? [modelRef] : []}
          />
        )}
        {depthOfField.enabled && <DepthOfField {...depthOfField} />}
        {bloom.enabled && <Bloom {...bloom} />}
        {vignette.enabled && <Vignette {...vignette} />}
        {glitch.enabled && <Glitch {...(glitch as unknown as GlitchProps)} />}
        {ascii.enabled && <ASCII {...ascii} />}
        {brightnessContrast.enabled && (
          <BrightnessContrast
            {...brightnessContrast}
            selection={modelRef ? [modelRef] : []}
          />
        )}
        {chromaticAberration.enabled && (
          <ChromaticAberration
            {...chromaticAberration}
            selection={modelRef ? [modelRef] : []}
          />
        )}
        {colorAverage.enabled && <ColorAverage {...colorAverage} />}
        {colorDepth.enabled && <ColorDepth {...colorDepth} />}
        {depth.enabled && <Depth {...depth} />}
        {tiltShift.enabled && <TiltShift {...tiltShift} />}
        {tiltShift2.enabled && <TiltShift2 {...tiltShift2} />}
        {dotScreen.enabled && <DotScreen {...dotScreen} />}
        {hueSaturation.enabled && <HueSaturation {...hueSaturation} />}
        {scanline.enabled && <Scanline {...scanline} />}
        {sepia.enabled && <Sepia {...sepia} />}
        {preview && showEditor && <Grid scale={scale} lineWidth={0.01} />}
      </>
    </EffectComposer>
  );
};
