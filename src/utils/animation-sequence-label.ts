interface ClipNameEntry {
  clip: {
    name: string;
  };
}

interface AnimationSequenceLabelInput {
  animations: Record<string, string | undefined>;
  clips: Record<string, ClipNameEntry[] | undefined>;
  selectedUuid?: string;
}

function getActiveClipName(
  input: AnimationSequenceLabelInput,
  uuid: string | undefined,
) {
  if (!uuid) return undefined;

  const animationName = input.animations[uuid];
  if (!animationName || !animationName.trim() || animationName === "none") {
    return undefined;
  }

  const hasMatchingClip = input.clips[uuid]?.some(
    (entry) => entry.clip.name === animationName,
  );

  return hasMatchingClip ? animationName : undefined;
}

export function getActiveAnimationSequenceLabel(
  input: AnimationSequenceLabelInput,
) {
  const selectedAnimationName = getActiveClipName(input, input.selectedUuid);
  if (selectedAnimationName) return selectedAnimationName;

  const animationNames = new Set<string>();

  for (const uuid of Object.keys(input.animations)) {
    const animationName = getActiveClipName(input, uuid);
    if (animationName) animationNames.add(animationName);
  }

  const names = Array.from(animationNames);
  if (names.length === 0) return undefined;

  return names.join("_");
}
