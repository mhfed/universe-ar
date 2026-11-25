import base64
import io
import json
import sys
import traceback

protocol = sys.stdout
sys.stdout = sys.stderr

from PIL import Image
import fashn_vton.pipeline as fashn


def send(**message):
    print(json.dumps(message), file=protocol, flush=True)


def track_sampling(iterable, *args, **kwargs):
    if kwargs.get("desc") != "Sampling":
        yield from original_tqdm(iterable, *args, **kwargs)
        return
    total = kwargs["total"]
    send(stage="sampling", step=0, total=total)
    for step, item in enumerate(iterable, 1):
        yield item
        send(stage="sampling", step=step, total=total)


original_tqdm = fashn.tqdm
fashn.tqdm = track_sampling
weights, reference = sys.argv[1:]
garment = Image.open(reference).convert("RGB")
Image.MAX_IMAGE_PIXELS = 4_000_000
pipeline = None

for line in sys.stdin:
    try:
        send(stage="loading")
        capture = base64.b64decode(json.loads(line)["image"], validate=True)
        with Image.open(io.BytesIO(capture)) as person:
            if person.width * person.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError("Capture exceeds pixel limit")
            person = person.convert("RGB")
        if pipeline is None:
            pipeline = fashn.TryOnPipeline(weights)
        send(stage="processing")
        result = pipeline(
            person_image=person,
            garment_image=garment,
            category="tops",
            garment_photo_type="model",
            num_samples=1,
            num_timesteps=24,
            guidance_scale=1.5,
            seed=42,
            segmentation_free=True,
        )
        with io.BytesIO() as output:
            result.images[0].save(output, format="PNG")
            send(image=base64.b64encode(output.getvalue()).decode("ascii"))
    except Exception:
        traceback.print_exc()
        send(stage="failed")
