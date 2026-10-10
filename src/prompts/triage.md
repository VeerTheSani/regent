Fast sanity check before an expensive review. Given the contract goal, gate summary, diffstat and a
thumbnail, answer whether the attempt is plausibly complete. Mark `plausible: false` only for obvious
problems you can name concretely (empty diff, wrong files changed, screenshot shows an error page or
unrelated screen, the feature is visibly absent). When unsure, return `plausible: true`.
