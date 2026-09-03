# Public Website Compatibility Assessment

Assessment date: August 29, 2026

Scores use a 1–5 scale. A site must support a read or local-UI workflow, expose usable semantic controls, avoid sensitive actions, and permit the proposed use under current terms.

| Candidate | Semantic markup | Route fit | Low-risk workflow | Reproducibility | Terms fit | Selector stability | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Wikipedia | 5 | 5 | 5 | 5 | 4 | 5 | Selected second public site |
| MDN Web Docs | 2 | 3 | 5 | 3 | 4 | 2 | Rejected: no visible homepage search control in live inspection |
| YouTube | 3 | 4 | 4 | 2 | 1 | 2 | Blocked without written permission or another applicable exception |

## Selected workflow: Wikipedia search

Live Chrome inspection of `https://en.wikipedia.org/wiki/Main_Page` found:

- A semantic search form with action `/w/index.php`.
- Input name `search` and accessible label `Search Wikipedia`.
- A visible `Search` button.
- Same-origin result navigation.

The proposed Automatic workflow fills a user-provided query, submits the search, waits for the same-origin result path, and extracts the article heading. It does not edit, authenticate, message, or collect personal information.

Wikimedia's Terms prohibit automated uses that are abusive, disruptive, or violate applicable usage policies. The evidence run must remain user-initiated, low-frequency, and non-disruptive. If the workflow uses Wikimedia APIs rather than ordinary page interaction, it must also follow the API and User-Agent policies.

Sources:

- Wikimedia Terms summary: `https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/Summary`
- Wikimedia API Usage Guidelines: `https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines`
- Wikimedia User-Agent Policy: `https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en`

## YouTube release blocker

YouTube's current Terms prohibit access through automated means such as robots, botnets, or scrapers except for stated exceptions such as prior written permission or applicable law. Capability Forge should not record an automated YouTube evidence run until the publisher documents a valid basis.

Source: `https://www.youtube.com/t/terms`

The challenge demo and Store listing must not claim YouTube compatibility from fixture tests or an unauthorized automated run.
