import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildAnimationClip } from "@/utils/pose-to-animation";
import { useModelsStore } from "@/store/next/models";
import { toast } from "sonner";
import type { PoseFrame } from "@/utils/pose-to-animation";

interface Props {
  frames: PoseFrame[];
  modelUuid: string;
  onDone: () => void;
  onBack: () => void;
}

export function SaveStep({ frames, modelUuid, onDone, onBack }: Props) {
  const addClip = useModelsStore((s) => s.addClip);
  const setAnimation = useModelsStore((s) => s.setAnimation);
  const clips = useModelsStore((s) => s.clips[modelUuid] ?? []);

  const defaultName = `Camera Capture ${clips.length + 1}`;
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  const duration = frames.length > 0 ? frames[frames.length - 1].time : 0;

  const handleSave = async () => {
    const trimmed = name.trim() || defaultName;
    setSaving(true);
    try {
      const clip = buildAnimationClip(frames, trimmed);
      addClip(modelUuid, clip);
      setAnimation(modelUuid, trimmed);
      toast.success(
        `Animation "${trimmed}" saved (${duration.toFixed(1)}s, ${frames.length} frames)`,
      );
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      <div>
        <h2 className="text-lg font-semibold">Save Animation</h2>
        <p className="text-sm text-muted-foreground">
          {frames.length} frames · {duration.toFixed(2)}s recorded
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="anim-name">Animation Name</Label>
        <Input
          id="anim-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleSave} disabled={saving || frames.length === 0}>
          {saving ? "Saving…" : "Save to Model"}
        </Button>
      </div>
    </div>
  );
}
