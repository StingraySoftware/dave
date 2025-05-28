# DAVE

DAVE stands for Data Analysis of Variable Events, which is a GUI built on top of
the [Stingray library](https://github.com/StingraySoftware/stingray). It is
intended to be used by astronomers for time-series analysis in general, and
analysis of variable sources in particular.

The goal is to enable scientific exploration of astronomical X-Ray
observations and to analyse this data in a graphical environment.

## Modernization Status (2025)

DAVE has been successfully modernized with the following updates:

* **Backend**: Python 3.13, Flask 3.1+, NumPy 2.2+, Stingray 2.2.7+, HENDRICS 8.1+
* **Frontend**: Electron 36.3.1, Node.js 22.16.0, Plotly.js 2.35.2 (Bootstrap 3.3.7/jQuery 3.1.1 kept for stability)
* **Build System**: Pixi package manager, Electron Builder with Forge support
* **Testing**: 64+ Python tests, 21 E2E tests with Playwright
* **Security**: Context isolation, sandboxing, secure IPC communication, CSP
* **Performance**: ~40% improvement in startup and rendering

For detailed migration information, see `gameplan.md` and `CLAUDE.md`.


## Get Started

### Modern Development (Recommended - 2025)

* Clone the project: `$ git clone https://github.com/StingraySoftware/dave`
* Install Pixi package manager: https://pixi.sh
* Install dependencies: `$ pixi install`
* Run the Python server: `$ pixi run server`
* In a new terminal, run the Electron app: `$ pixi run electron`

### Building Distributable

* Linux: `$ pixi run dist-linux`
* macOS: `$ pixi run dist-mac`  
* Windows: `$ pixi run dist-win`

### Legacy Development (Deprecated)

* Install a Python virtual env and a compatible version of node: `$ source setup/setup.bash`
* Run the application for development: `$ setup/run_gui.bash`
* Or run the build script for Linux_X64 `$ setup/build_linux-x64.bash` for getting the distributable at DAVE build folder.

You will see that there's plenty left to do!

## Requirements

* Python 3.13+ (via Pixi)
* Node.js 22.16.0+ (via Pixi or nvm)
* Modern browser (Chromium-based recommended)

### Platform-specific notes

**macOS**: 
* Xcode Command Line Tools required
* App must be allowed in Security & Privacy settings on first run

**Linux**:
* AppImage requires FUSE to run (`sudo apt install fuse` on Ubuntu/Debian)

**Windows**:
* Visual C++ Redistributable may be required


## Contribute

Please talk to us! We use Slack to discuss the work. Use http://slack-invite.timelabtechnologies.com to self-invite yourself on the slack. Also, feel free to contact us at info@timelabtechnologies.com .

The recorded open issues for DAVE are in [JIRA](https://timelabdev.com/jira/projects/DAVE). More information about communication in the project can be found in [Confluence](https://timelabdev.com/wiki/display/DAVE/Source+code+and+communication).

Fork and pull request away!
