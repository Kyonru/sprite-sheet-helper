import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

interface Props {
  onAccept: () => void;
  onCancel: () => void;
}

export function DisclaimerStep({ onAccept, onCancel }: Props) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-green-500 shrink-0" size={32} />
        <div>
          <h2 className="text-lg font-semibold">Privacy Notice</h2>
          <p className="text-sm text-muted-foreground">Before using camera capture, please read the following</p>
        </div>
      </div>

      <ul className="text-sm space-y-2 border rounded-md p-4 bg-muted/40">
        <li>✅ All pose detection runs <strong>entirely in your browser</strong> — no video is uploaded or transmitted.</li>
        <li>✅ No images or video frames are stored after the modal closes.</li>
        <li>✅ Your webcam feed is only active while this modal is open.</li>
        <li>⚠️ Your browser will request <strong>camera permission</strong>. You can revoke it at any time in browser settings.</li>
        <li>⚠️ Best results require good lighting and a Mixamo-compatible humanoid rig.</li>
      </ul>

      <div className="flex items-center gap-3">
        <Checkbox
          id="accept"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(!!v)}
        />
        <Label htmlFor="accept" className="cursor-pointer">
          I understand and want to proceed
        </Label>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!accepted} onClick={onAccept}>Start Capture</Button>
      </div>
    </div>
  );
}
