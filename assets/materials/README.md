# Textured material provenance

The bundled floor textures are **Terrazzo Tiles** by **Amal Kumar** from Poly Haven:

https://polyhaven.com/a/terrazzo_tiles

License: **CC0 1.0 Universal**, allowing copying, redistribution and modification without attribution. Attribution here is provided for reproducibility.

Locally vendored 1K JPEG material maps:

| File | Map | MD5 (download verification) |
| --- | --- | --- |
| `terrazzo_tiles_diff_1k.jpg` | diffuse/albedo (sRGB) | `12c27a579c2ed49de854b8a86e33647b` |
| `terrazzo_tiles_rough_1k.jpg` | roughness (linear) | `e34bfd2f4fee1b2b9f310a71588aad17` |
| `terrazzo_tiles_nor_gl_1k.jpg` | OpenGL normal (linear) | `a5f6d05f27db4151227535bdbc82c048` |

Assets are bundled with the Vite build; they do not require runtime requests to Poly Haven. See `viewer/supermarket-interior.ts`.

Development-only visual references are not included in this repository. The bundled floor maps above are distinct runtime assets, with their CC0 provenance retained.
