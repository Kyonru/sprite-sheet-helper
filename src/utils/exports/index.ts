import { zipExporter } from "./zip";
import { bevyExporter } from "./bevy";
import type { Exporter, ExportFormat } from "@/types/file";
import { love2dAnim8Exporter, love2dVanillaExporter } from "./love2d";
import { turboRustExporter } from "./turbo";
import { phaserExporter } from "./phaser";
import { godotExporter } from "./godot";
import { pygameExporter } from "./pygame";
import { raylibExporter } from "./raylib";
import { unityExporter } from "./unity";
import { SpritesheetExporter } from "./spritesheet";
import { gifExporter } from "./gif";

export const exporters = {
  [zipExporter.id]: zipExporter,
  [bevyExporter.id]: bevyExporter,
  [love2dVanillaExporter.id]: love2dVanillaExporter,
  [love2dAnim8Exporter.id]: love2dAnim8Exporter,
  [turboRustExporter.id]: turboRustExporter,
  [phaserExporter.id]: phaserExporter,
  [godotExporter.id]: godotExporter,
  [pygameExporter.id]: pygameExporter,
  [raylibExporter.id]: raylibExporter,
  [unityExporter.id]: unityExporter,
  [SpritesheetExporter.id]: SpritesheetExporter,
  [gifExporter.id]: gifExporter,
} satisfies Record<ExportFormat, Exporter<ExportFormat>>;
