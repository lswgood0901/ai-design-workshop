"""MLX four-bit inference; imported only inside the supervised child."""
import platform
import subprocess
import sys
from pathlib import Path


def run(job: dict, model_dir: Path, output: Path):
    import mlx.core as mx

    mx.set_memory_limit(6 * 2 ** 30)  # Advisory; the independent parent also monitors memory.
    mx.set_cache_limit(128 * 2 ** 20)
    mx.set_wired_limit(0)
    args = ['mflux-workshop', '--model', str(model_dir), '--base-model', 'flux2-klein-4b',
            '--low-ram', '--mlx-cache-limit-gb', '0.125', '--vae-tiling', '--vae-tile-size', '256',
            '--steps', str(job['num_inference_steps']), '--width', str(job['width']),
            '--height', str(job['height']), '--seed', str(job['seed']),
            '--prompt', job['prompt'], '--output', str(output), '--no-exif']
    if platform.system() == 'Darwin':
        chip = subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'], text=True).strip()
        if chip.startswith('Apple M1'):
            args += ['--compute-precision', 'float16']
    if job['images']:
        from mflux.models.flux2.cli.flux2_edit_generate import main
        args += ['--image-paths', *job['images']]
    else:
        from mflux.models.flux2.cli.flux2_generate import main
    sys.argv = args
    main()
