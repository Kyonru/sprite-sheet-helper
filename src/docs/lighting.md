---
title: Lighting
---

Lighting directly affects how your sprites look. Sprite Sheet Helper supports four light types that you can combine to achieve the look you want.

## Light Types

### Ambient Light

Fills the entire scene with uniform light from all directions. Use it to prevent completely dark shadows and control the overall brightness floor.

- **Intensity** — How bright the ambient fill is. Start low (0.2–0.5) to avoid washing out shadows.
- **Color** — Tint the ambient light for mood (e.g. cool blue for night scenes).

### Directional Light

A sun-like light that shines from one direction across the whole scene. It casts parallel shadows and is the primary light in most setups.

- **Intensity** — Brightness of the light.
- **Color** — Color of the light.
- **Position** — Determines the direction the light comes from.

### Point Light

Emits light in all directions from a single point in space, like a light bulb or torch. Useful for local light sources.

- **Intensity** — Brightness.
- **Color** — Light color.
- **Distance** — How far the light reaches before it falls off.
- **Position** — Where in the scene the light is placed.

### Spot Light

A focused cone of light, like a flashlight or stage spotlight.

- **Intensity** — Brightness.
- **Color** — Light color.
- **Angle** — Width of the cone.
- **Penumbra** — Softness of the cone edge.
- **Distance** — Maximum reach.
- **Position / Target** — Origin and direction of the beam.

## Recommended Setups

**Flat, even lighting** — One ambient light at full intensity, no other lights. Good for pixel art or stylized sprites.

**Three-point lighting** — A key directional light, a softer fill light on the opposite side, and a rim light behind the model. Creates professional-looking depth.

**Stylized top-down** — Directional light from slightly above center, low ambient to keep shadows visible.

## Tips

- Use the **Color** picker to warm or cool your key light for different time-of-day moods.
- Add a subtle **blue ambient** light to simulate outdoor skylight bounce.
- Keep your lighting consistent across all animation frames — lights don't animate.
