# Hybridize! — Match • Stack • Correct

**Hybridize!** is a browser-based educational game about molecular recognition, hybridization, reversible binding, error correction, and cooperative stabilization.

Players work with two complementary strands made from abstract coloured shape units. The goal is to transform an initially imperfect set of pairings into a perfect duplex by forming and breaking bonds according to dice-controlled pairing rules.

## Play the Game

Open `index.html` in a browser or run the project locally using a simple development server.

A hosted version can be made available through GitHub Pages.

## Educational Motivation

Hybridize! was inspired by research in **The U.S. National Science Foundation Center for the Creation of Abiotic Replicating Materials and Assemblies (NSF CARMA)**, supported by the **Centers for Chemical Innovation (CCI) Program**.

Learn more about NSF CARMA:
https://carma.utexas.edu/about

## Gameplay Overview

The game represents molecular hybridization using two strands, A and B. Each unit on one strand has a complementary partner on the other strand.

Players use dice outcomes to determine whether each class of unit can form or break a bond in a given round. The player wins when every unit on Strand A is paired with its correct partner on Strand B.

Key concepts represented in the game include:

* Molecular complementarity
* Reversible binding
* Error correction
* Kinetic frustration
* Cooperative stabilization through stacking
* Sequence-specific assembly

## Current Features

* Single-player mode
* Abstract four-colour molecular alphabet
* Shape-based and colour-based visual pairing system
* Dice-controlled form/unpair dynamics
* Adjustable pairing probabilities
* Optional frustration events
* Energy tracking
* Round counter
* Completion timer
* Immediate win detection when the perfect duplex is formed

## Running Locally

The project is a static web app and does not require a build step.

### Option 1: Open directly

Open:

```text
index.html
```

in a modern web browser.

### Option 2: Use VS Code Live Server

1. Open the project folder in VS Code.
2. Right-click `index.html`.
3. Select **Open with Live Server**.
4. The game should open at a local address such as:

```text
http://127.0.0.1:5500/index.html
```

## Project Structure

```text
hybridize/
├── index.html
├── styles.css
├── engine.js
├── ui.js
├── images/
│   ├── hybridize-banner.png
│   └── carma.png
├── LICENSE
└── README.md
```

## Development Notes

This project uses vanilla HTML, CSS, and JavaScript. It does not require React, npm, bundlers, or external JavaScript dependencies.

Core game logic is contained in `engine.js`. User-interface rendering and interaction logic are contained in `ui.js`.

## Attribution

Developed by **Dr. Michael A. Webb**, Princeton University.

Hybridize! was inspired by research in NSF CARMA, the U.S. National Science Foundation Center for the Creation of Abiotic Replicating Materials and Assemblies, supported by the Centers for Chemical Innovation Program.

## License

The source code is released under the MIT License. See `LICENSE` for details.

Images, logos, and institutional marks may have separate ownership or usage restrictions. In particular, the NSF CARMA logo should be used only with appropriate permission or attribution.

