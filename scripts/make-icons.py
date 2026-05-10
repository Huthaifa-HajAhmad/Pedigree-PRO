"""Generate minimal placeholder PNG and ICO icons for Tauri build."""
import struct
import zlib
import os

def make_png(width: int, height: int, r: int = 100, g: int = 117, b: int = 247) -> bytes:
    """Create a minimal valid PNG with a solid color."""
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes([r, g, b]) * width

    def chunk(typ: bytes, data: bytes) -> bytes:
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )

# Target directory
icons_dir = os.path.join("artifacts", "haplopainter", "src-tauri", "icons")
os.makedirs(icons_dir, exist_ok=True)

# Generate 32x32 PNG
with open(os.path.join(icons_dir, "32x32.png"), "wb") as f:
    f.write(make_png(32, 32))
print("Created 32x32.png")

# Generate 128x128 PNG
with open(os.path.join(icons_dir, "128x128.png"), "wb") as f:
    f.write(make_png(128, 128))
print("Created 128x128.png")

# Generate 256x256 PNG (@2x)
with open(os.path.join(icons_dir, "128x128@2x.png"), "wb") as f:
    f.write(make_png(256, 256))
print("Created 128x128@2x.png")

# Generate minimal valid .ico (contains a single 32x32 24-bit BMP + AND mask)
def make_ico() -> bytes:
    """Create a minimal valid .ico file with one 32x32 image."""
    # BMP data: 32x32, 24-bit, bottom-up
    bmp_data = b""
    for y in range(31, -1, -1):
        row = b""
        for x in range(32):
            row += bytes([247, 117, 100])  # BGR
        # Each row is padded to 4-byte boundary
        bmp_data += row
        # 32 * 3 = 96, already aligned on 4-byte boundary

    # AND mask: 32x32 = 128 bytes (monochrome, 0 = opaque)
    and_mask = b"\x00" * 128

    # BITMAPINFOHEADER
    bih = struct.pack("<IiiHHIIiiII",
        40,   # biSize
        32,   # biWidth
        64,   # biHeight (doubled for ICO: image + mask)
        1,    # biPlanes
        24,   # biBitCount
        0,    # biCompression (BI_RGB)
        len(bmp_data) + len(and_mask),  # biSizeImage
        0,    # biXPelsPerMeter
        0,    # biYPelsPerMeter
        0,    # biClrUsed
        0,    # biClrImportant
    )

    image_data = bih + bmp_data + and_mask
    image_size = len(image_data)

    # ICO header
    ico_header = struct.pack("<HHH", 0, 1, 1)  # reserved, type=ICO, count=1
    # ICO directory entry
    entry = struct.pack("<BBBBHHII",
        32, 32, 0, 0,  # width, height, colors, reserved
        1, 24,          # planes, bpp
        image_size,     # size
        22,             # offset (6 + 16)
    )

    return ico_header + entry + image_data

with open(os.path.join(icons_dir, "icon.ico"), "wb") as f:
    f.write(make_ico())
print("Created icon.ico")

# macOS .icns placeholder (just copy the 128x128 PNG — Tauri handles conversion)
import shutil
shutil.copy(os.path.join(icons_dir, "128x128.png"), os.path.join(icons_dir, "icon.icns"))
print("Created icon.icns (placeholder)")

print("\nAll icons generated.")