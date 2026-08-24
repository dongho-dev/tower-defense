from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def remove_detached_specks(image: Image.Image) -> Image.Image:
    alpha = bytearray(image.getchannel("A").tobytes())
    width, height = image.size
    visited = bytearray(width * height)
    components: list[list[int]] = []

    for start, value in enumerate(alpha):
        if value <= 12 or visited[start]:
            continue
        visited[start] = 1
        component: list[int] = []
        pending = deque([start])
        while pending:
            index = pending.popleft()
            component.append(index)
            x = index % width
            y = index // width
            for offset in (-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1):
                neighbor = index + offset
                if neighbor < 0 or neighbor >= len(alpha) or visited[neighbor]:
                    continue
                neighbor_x = neighbor % width
                neighbor_y = neighbor // width
                if abs(neighbor_x - x) > 1 or abs(neighbor_y - y) > 1:
                    continue
                if alpha[neighbor] <= 12:
                    continue
                visited[neighbor] = 1
                pending.append(neighbor)
        components.append(component)

    if not components:
        return image
    largest = max(len(component) for component in components)
    minimum = max(80, round(largest * 0.004))
    for component in components:
        if len(component) >= minimum:
            continue
        for index in component:
            alpha[index] = 0

    cleaned = image.copy()
    cleaned.putalpha(Image.frombytes("L", image.size, bytes(alpha)))
    return cleaned


def frame_unit(image: Image.Image, size: int, padding: int) -> Image.Image:
    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("unit image contains no visible pixels")
    crop = image.crop(alpha_bounds)
    available = size - padding * 2
    scale = min(available / crop.width, available / crop.height)
    dimensions = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    crop = crop.resize(dimensions, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    origin = ((size - crop.width) // 2, (size - crop.height) // 2)
    output.alpha_composite(crop, origin)
    return output


def clear_alpha_border(image: Image.Image, width: int = 3) -> Image.Image:
    alpha = image.getchannel("A")
    alpha.paste(0, (0, 0, image.width, width))
    alpha.paste(0, (0, image.height - width, image.width, image.height))
    alpha.paste(0, (0, 0, width, image.height))
    alpha.paste(0, (image.width - width, 0, image.width, image.height))
    cleaned = image.copy()
    cleaned.putalpha(alpha)
    return cleaned


def restore_arc_core(image: Image.Image) -> Image.Image:
    raw_path = ROOT / "assets/towers/arc-source.png"
    if not raw_path.exists():
        return image
    with Image.open(raw_path) as opened:
        raw = opened.convert("RGBA")
    output = image.copy()
    output_pixels = output.load()
    raw_pixels = raw.load()
    center_x = round(image.width * 0.5)
    center_y = round(image.height * 0.257)
    inner_radius = round(image.width * 0.024)
    outer_radius = round(image.width * 0.038)
    for y in range(center_y - outer_radius, center_y + outer_radius + 1):
        for x in range(center_x - outer_radius, center_x + outer_radius + 1):
            distance = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            if distance > outer_radius:
                continue
            source_pixel = raw_pixels[x, y]
            restored_alpha = 255 if distance <= inner_radius else round(
                255 * (outer_radius - distance) / max(1, outer_radius - inner_radius)
            )
            current = output_pixels[x, y]
            output_pixels[x, y] = (
                source_pixel[0],
                source_pixel[1],
                source_pixel[2],
                max(current[3], restored_alpha),
            )
    return output


def optimize_unit(source: str, target: str, size: int, padding: int) -> None:
    with Image.open(ROOT / source) as opened:
        image = opened.convert("RGBA")
        image = clear_alpha_border(image)
        if source.endswith("arc-v3.png"):
            image = restore_arc_core(image)
        output = frame_unit(image, size, padding)
        output = remove_detached_specks(output)
        output = frame_unit(output, size, padding)
        output.save(ROOT / target, "WEBP", quality=92, method=6, exact=True)


def optimize_environment(source: str, target: str, max_width: int, quality: int) -> None:
    with Image.open(ROOT / source) as opened:
        image = opened.convert("RGB")
        if image.width > max_width:
            height = round(image.height * (max_width / image.width))
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        image.save(ROOT / target, "WEBP", quality=quality, method=6)


def main() -> None:
    for tower in ("pulse", "scatter", "rail", "arc", "flak", "beam", "cryo", "nova"):
        optimize_unit(
            f"assets/towers/{tower}-v3.png",
            f"assets/towers/{tower}-game.webp",
            512,
            24,
        )

    for enemy in ("drone", "skirmisher", "armor"):
        optimize_unit(
            f"assets/enemies/{enemy}-v3.png",
            f"assets/enemies/{enemy}-game.webp",
            256,
            14,
        )
    optimize_unit(
        "assets/enemies/titan-v3.png",
        "assets/enemies/titan-game.webp",
        320,
        18,
    )

    optimize_environment(
        "assets/field/rift-deck-v3.png",
        "assets/field/rift-deck-game.webp",
        1600,
        90,
    )
    optimize_environment(
        "assets/nexus-horizon-v2.png",
        "assets/nexus-horizon-game.webp",
        1600,
        88,
    )


if __name__ == "__main__":
    main()
