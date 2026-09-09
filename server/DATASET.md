# Dataset

## Chosen dataset: TrashNet

**Source:** https://huggingface.co/datasets/garythung/trashnet (mirror of the original
[garythung/trashnet](https://github.com/garythung/trashnet) GitHub repo — a Stanford
CS229 project by Gary Thung and Mindy Yang).

**File used:** `dataset-resized.zip` (42.8 MB) — the official pre-resized version
(512×384, consistent format/orientation), not `dataset-original.zip` (3.6 GB of
unprocessed originals — unnecessary for this task and impractical to move around).

**License:** MIT (stated on both the GitHub repo and the Hugging Face dataset card).
Permits commercial and private use.

## Why this dataset

- Its 6 classes are **exactly** the ones this app needs — `cardboard`, `glass`,
  `metal`, `paper`, `plastic`, `trash` — with no relabeling/consolidation required.
  (Compare: TACO, referenced in old `.gitignore` entries from an earlier attempt,
  is an object-*detection* dataset with ~60 fine-grained litter categories and
  multi-object images with bounding boxes — a much larger remapping/relabeling
  effort to turn into a clean single-label 6-way classifier, for no accuracy
  benefit over a dataset that already matches the target taxonomy.)
- It's the de facto standard academic dataset for this exact task — widely used
  in published trash-classification work, so results are comparable to a known
  baseline rather than a from-scratch, unverified data source.
- Already single-label, one dominant object per photo, consistent resolution —
  no additional relabeling or resizing pipeline needed beyond what's in
  `prepare_dataset.py`.
- **Confirms a pre-existing assumption in this codebase**: `DATASET_COUNTS` in
  `src/lib/trashStats.ts` already hardcodes `{cardboard: 403, glass: 501, metal:
  410, paper: 594, plastic: 482, trash: 137}` — the *exact* per-class counts of
  this dataset. TrashNet was clearly the intended dataset from early on; this
  work makes that real instead of a placeholder reference.

## Per-class image counts (after cleaning — see below)

| Class     | Images |
|-----------|-------:|
| cardboard |    403 |
| glass     |    501 |
| metal     |    410 |
| paper     |    594 |
| plastic   |    482 |
| trash     |    137 |
| **Total** | **2,527** |

## Known limitation: class imbalance

`trash` (general trash) has under a quarter as many images as `paper`. This is a
real, documented property of TrashNet, not something introduced here — the
"general trash" category is inherently a catch-all, harder to source consistent
examples for than well-defined material categories. Addressed during training via
a `WeightedRandomSampler` (inverse class frequency) on the training split only —
see `train_classifier.py` — rather than by fabricating/duplicating images. A
second, supplementary "general trash" dataset was considered but not added: doing
so under time pressure without careful curation risks introducing label-quality or
domain-shift issues worse than the imbalance itself. This is called out again in
the final evaluation report as a specific area to watch (`trash` class recall) and
is the most likely candidate for a future improvement.

## Quality checks performed (`prepare_dataset.py`)

- Every image opened and decoded with PIL (`Image.verify()`) — corrupt files
  would be dropped. Result: **0 corrupt files** found.
- Exact-duplicate detection via SHA-256 file hash, per class. Result: **0 exact
  duplicates** found.
- Resolution/format already consistent (512×384 JPEG) from the `dataset-resized`
  preprocessing TrashNet's own maintainers did — no further normalization needed
  beyond the 224×224 resize applied uniformly at train/eval time (see
  `train_classifier.py` / `classifier_api.py`).

## Reproducing the download

```bash
python -m venv .venv && .venv\Scripts\Activate.ps1   # if not already done
pip install -r server/requirements-train.txt

python -c "
from huggingface_hub import hf_hub_download
hf_hub_download(repo_id='garythung/trashnet', repo_type='dataset',
                 filename='dataset-resized.zip', local_dir='server/dataset-trashnet')
"
cd server/dataset-trashnet && python -c "import zipfile; zipfile.ZipFile('dataset-resized.zip').extractall('.')"
cd ../..
python server/prepare_dataset.py   # validates + writes split_manifest.json
python server/train_classifier.py  # trains + writes server/models/*
python server/evaluate_classifier.py
```

`server/dataset-trashnet/` (raw images + zip + split manifest) is gitignored —
it's large, binary, and fully reproducible from the steps above, so it isn't
committed. `server/models/trash_classifier.pth` (the trained weights, ~9 MB) is
also gitignored for the same reason; `class_names.json`, `training_config.json`,
and `evaluation_report.json` are tracked (small, human-readable, and the actual
documentation of what was trained/how it performed).
