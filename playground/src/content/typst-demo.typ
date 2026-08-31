#let conf(
  authors: (),
  abstract: [],
  doc,
) = {
  // Set and show rules from before.
  // ...
  
  place(
    top + center,
    float: true,
    scope: "parent",
    clearance: 2em,
    {
      title()
      
      let count = authors.len()
      let ncols = calc.min(count, 3)
      grid(
        columns: (1fr,) * ncols,
        row-gutter: 24pt,
        ..authors.map(author => [
          #author.name \
          #author.affiliation \
          #link("mailto:" + author.email)
        ]),
      )
      
      par(justify: false)[
        *Abstract* \
        #abstract
      ]
    },
  )
  
  doc
}

#set document(title: [
  A Fluid Dynamic Model for
  Glacier Flow
])

#show: conf.with(
  authors: (
    (
      name: "Theresa Tungsten",
      affiliation: "Artos Institute",
      email: "tung@artos.edu",
    ),
    (
      name: "Eugene Deklan",
      affiliation: "Honduras State",
      email: "e.deklan@hstate.hn",
    ),
  ),
  abstract: lorem(80),
)

= Introduction
#lorem(90)

== Motivation
#lorem(140)

== Problem Statement
#lorem(50)

= Related Work
#lorem(200)
