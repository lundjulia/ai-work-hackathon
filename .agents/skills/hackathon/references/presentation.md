# Presentation and optional landing page

Follow the event's required format and time limit. A worker can own the deck, script, and hosting; the main thread checks the claims and the delivery plan.

## HTML deck

Copy the [presentation folder](../assets/presentation/) into the project's static or public directory. Edit only `index.html`: the title, the theme block, and the `<section data-slide>` blocks. Delete unused layouts and replace all instructional copy. `deck.css` and `deck.js` handle layout, navigation (arrow keys, `F` for fullscreen, `?` for help, swipe), and print; leave them unchanged unless a layout is missing.

Cover the problem, the product, the real demo, the evidence, and the next step. Label evidence accurately: a founder story, a user session, a synthetic example, a simulation, and observed behavior are different things.

For a landing-page slide, use an actual screenshot and a clickable URL. Keep images next to the deck with relative paths, and use only permitted, non-private images.

Before delivery, open the actual deck at presentation size and check navigation, fullscreen, links, and images. Rehearse against the demo candidate. A local preview URL is not an audience link, so check the published route if hosting is authorized.

## Landing page

Optional. Build one only if it serves explanation, recruitment, or access and the core requirements are covered. Agree on the intended action and an honest product promise first, and do not let it compete with the main build.

For signups, define what a signup means, then verify storage, confirmation and failure states, and retrieval or deletion end to end with synthetic data. Remove the test record afterwards. Interest is not usage.
