# Where the training and nutrition rules come from

Every rule the app coaches with is listed here with what backs it. **Research** means a published study or meta-analysis says so. **Practice** means it is common coaching practice that fits the research but hasn't been tested as a rule itself. When you change or add a rule, update this file, and say which of the two it is.

Checked: November 2026.

## Training

| Rule in the app | Backing | Source |
|---|---|---|
| Aim for about 10–20 hard sets per muscle a week for focus muscles. More sets grow more muscle, with diminishing returns. Growth is still detectable from about 4 sets a week, so non-focus muscles are only flagged under 4. | Research | Pelland et al. 2025, *Sports Med* ([doi](https://doi.org/10.1007/s40279-025-02344-w)); Schoenfeld, Ogborn & Krieger 2017, *J Sports Sci* |
| A lift's main muscles count a full set and helping muscles half a set (`muscleWork`). | Research | Pelland et al. 2025: the "fractional" method predicted growth best |
| Take most sets to 0–2 reps short of failure; isolation moves can go to failure. | Research | Robinson et al. 2024, *Sports Med* ([doi](https://doi.org/10.1007/s40279-024-02069-2)): growth improves as sets end closer to failure |
| Rep ranges from 6 to 20 all build muscle when sets are hard. | Research | Schoenfeld et al. 2017, *J Strength Cond Res* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/28834797/)): similar growth across loads; heavier loads are better for max strength |
| Rest at least 90 seconds on isolation moves and 2–3 minutes on compounds. | Research for "over a minute"; practice for 2–3 minutes | Singer et al. 2024, *Front Sports Act Living* ([doi](https://doi.org/10.3389/fspor.2024.1429789)): a small benefit to resting over 60 s, none detected past 90 s. Longer rests on heavy compounds keep the weight on the bar. |
| Double progression: add a rep until every set is at the top of the range, then add weight (`targetFor`). | Research | Plotkin et al. 2022, *PeerJ* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/36199287/)): progressing reps or load both work |
| No scheduled deloads. | Research (one trial) | Coleman et al. 2024, *PeerJ* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/38274324/)): a week off mid-program gave no extra growth and slightly less strength |
| A stall is 3+ sessions and 2+ weeks without a new best; back off about 10% and build back up (`stallOf`). | Practice | No direct trial. The definition and the 10% are conventions. |
| Weight jumps: 10 lbs on Smith lifts, 5 lbs elsewhere, editable per exercise (`jumpFor`). | Practice | Set by the equipment, not by research |
| Estimated 1-rep max uses the Epley formula (`e1rm`). | Practice | A standard estimate. It is less accurate above about 10 reps, so use it for trends, not as a true max. |
| Generated programs train each muscle about twice a week. | Research | Pelland et al. 2025: once weekly sets are equal, frequency adds little for growth, so the split is chosen for schedule and recovery |
| People lifting under a year get at most 3 sets per exercise and 7 exercises a day. | Practice | Follows from the diminishing returns above |
| Supersets and drop sets are allowed to save time. | Practice | Treated as time-savers, not as better for growth |

## Nutrition and bodyweight

| Rule in the app | Backing | Source |
|---|---|---|
| Lean bulk: about +250 cal and 0.25–0.5 lb a week. | Research | Helms et al. 2023, *Sports Med Open* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/37914977/)): faster weight gain mainly added fat, not muscle or strength |
| Cut: lose about 0.5–1% of body weight a week and keep lifting heavy. | Research | Garthe et al. 2011, *Int J Sport Nutr Exerc Metab* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/21558571/)): about 0.7% a week kept (and added) lean mass better than 1.4% |
| Protein 0.9 g/lb (about 2 g/kg); 1 g/lb on a cut. | Research | Morton et al. 2018, *Br J Sports Med* ([PubMed](https://pubmed.ncbi.nlm.nih.gov/28698222/)): benefits level off around 1.6 g/kg. The targets sit above that on purpose, as a margin. |
| Starting calories: Mifflin-St Jeor × activity, then adjusted by the weekly trend. | Practice | The equation is an estimate; the weekly weight trend is what corrects it |
| Calorie changes in ±150 steps, once a week (`calButton`). | Practice | Small enough to see the effect within a week or two |
| Mini-cut of 6–8 weeks after a bulk, about 5% lighter (`nextPhases`). | Practice | A convention, not a tested protocol |
| Step goal of 8,000 a day; creatine 3–5 g a day; sleep 7.5–8 hours. | General health guidance | Not re-checked against sources in this round |

## What this means

The core of the coaching (volume, effort, rest, progression, no forced deloads, bulk and cut pace, protein) follows current research. The parts marked **Practice** are reasonable defaults that a person can change, and the app's text should not present them as proven.
