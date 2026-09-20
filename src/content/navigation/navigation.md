---
# src/content/navigation/navigation.md
#
# The site's menus — the top bar and the footer — as content rather than code,
# so labels and order can be changed in the CMS without a developer.
#
# Routes live here too, alongside their labels. That is a deliberate change to
# the older "link labels are content; route paths stay in code" rule: a menu
# item whose label and destination are edited in two different places is one
# somebody will half-move. The safety net is in scripts/check-cms-schema.mjs,
# which fails the build if an internal href here does not match a real page.
#
# A link is treated as external when its href starts with http. Nothing has to
# be ticked — an external link gets target="_blank" and rel="noopener" on its
# own, which is one fewer thing for an editor to get wrong.

# The top menu.
#
# Home is deliberately not here. The logo links to / from every page, which is
# where people look for it, and a menu item saying the same thing spent a slot
# that Race reports now uses.
#
# Order is by what a newcomer wants first: joining, then the club's own races,
# then when things happen, then how we did, then the writing, then how to ask.
primary:
  - label: "Join us"
    href: "/join-us"
  - label: "Our races"
    href: "/our-races"
  - label: "Calendar"
    href: "/calendar"
  - label: "Results"
    href: "/results"
  - label: "Race reports"
    href: "/race-reports"
  - label: "Contact"
    href: "/contact"

# The button in the header, on every page at every width.
#
# Joining is the one thing the site is actually asking a visitor to do, and on
# a phone the whole menu is behind a hamburger - so without this the primary
# call to action is two taps away everywhere except the homepage.
cta:
  label: "Join us"
  href: "/join-us"

# The footer, in three columns.
#
# Welfare stays first in the first column: CLAUDE.md requires the welfare
# contact to be findable in one click from every page, and the footer is what
# delivers that on the pages that have nothing else.
#
# Race Calendar is deliberately gone. It pointed at /calendar#race-calendar
# while the top menu already carried Calendar, so the footer was offering a
# second route to a page the menu covers.
footerGroups:
  - label: "Looking after you"
    links:
      - label: "Welfare"
        href: "/welfare"
      - label: "Inclusion"
        href: "/inclusion"
      - label: "Privacy"
        href: "/privacy"
  - label: "The Club"
    links:
      - label: "Rules & constitution"
        href: "/rules-and-constitution"
      - label: "Club kit"
        href: "/club-kit"
      - label: "Pub runs"
        href: "/pub-runs"
  - label: "Connect"
    links:
      - label: "Facebook"
        href: "https://www.facebook.com/groups/161908423862991/"
      - label: "Strava"
        href: "https://www.strava.com/clubs/246805/leaderboard"
      - label: "England Athletics"
        href: "https://www.englandathletics.org/"

---
