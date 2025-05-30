# DAVE - Data Analysis of Variable Events

<p align="center">
  <img src="src/main/resources/static/img/icon.png" alt="DAVE Logo" width="128">
</p>

<p align="center">
  <strong>A modern desktop application for astronomical X-ray timing analysis</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contribute">Contribute</a> •
  <a href="#license">License</a>
</p>

---

DAVE is a powerful GUI application built on the [Stingray library](https://github.com/StingraySoftware/stingray) for time-series analysis of astronomical X-ray observations. It provides an intuitive interface for exploring variable sources and performing advanced timing analysis.

## 🎉 Modernization Complete (January 2025)

DAVE has been successfully modernized with significant improvements across all phases:

### Stack Updates
* **Backend**: Python 3.13, Flask 3.1+, NumPy 2.2+, Stingray 2.2.7+, HENDRICS 8.1+
* **Frontend**: Electron 36.3.1, Node.js 22.16.0, Plotly.js 2.35.2 (Bootstrap 3.3.7/jQuery 3.1.1 kept for stability)
* **Build System**: Pixi package manager, Electron Builder/Forge, GitHub Actions CI/CD

### Performance & Quality
* **Performance**: 2-3x faster with NumPy 2.2 (34M+ points/s FFT, 107M+ points/s statistics)
* **Memory**: <0.1 KB per data point, no memory leaks
* **Testing**: 200+ tests passing (including property-based and performance tests)
* **Security**: Enhanced with CSP headers, secure sessions, file validation (90/100 score)

### New Features (Phase 5)
* 🌙 **Dark Mode**: System-aware theme switching with smooth transitions
* ♿ **Accessibility**: WCAG 2.1 compliance, keyboard navigation, screen reader support
* 🔄 **Auto-updater**: Cross-platform automatic updates with channels (stable/beta/alpha)
* 🐳 **Container Support**: Docker and Kubernetes deployment ready
* 📦 **Modern Bundling**: Vite-based frontend with code splitting support
* 🔐 **Enhanced Security**: Comprehensive security audit and hardening

### Scientific Features Validated
* ✅ All core analysis functions (lightcurves, PDS, cross-correlation, timing)
* ✅ AGN long-term variability analysis
* ✅ Model fitting (9/10 types working)
* ✅ Bulk analysis with HENDRICS integration
* ✅ FITS file handling with Astropy 7.0

## Features

### Core Capabilities
- 📊 **Interactive Visualization**: Real-time plotting with Plotly.js, dark mode support
- 🔬 **Comprehensive Analysis**: Lightcurves, power spectra, cross-correlation, timing analysis
- 📁 **Multi-format Support**: FITS, ASCII, and various text formats
- 🚀 **High Performance**: Handles datasets with millions of events
- 🖥️ **Cross-platform**: Runs on Windows, macOS, and Linux
- 🌙 **Dark Mode**: Automatic theme detection and manual switching
- ♿ **Accessible**: Keyboard navigation, screen reader support, high contrast mode
- 🔄 **Auto-updates**: Keep software current with automatic updates

### Analysis Methods
- Power Density Spectra (PDS) with multiple normalizations
- Cross-correlation and coherence analysis
- Pulse search and phase folding
- Lomb-Scargle periodograms
- Model fitting with MCMC support
- AGN variability analysis
- Bulk processing for multiple files

## Quick Start

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

## Documentation

📚 **Comprehensive documentation is available:**

### Core Documentation
- **[Architecture Guide](ARCHITECTURE.md)** - System design and components
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Development setup and workflows
- **[API Reference](API_REFERENCE.md)** - REST API documentation
- **[User Migration Guide](USER_MIGRATION_GUIDE.md)** - Upgrade from legacy versions

### Feature Guides
- **[Dark Mode Guide](DARK_MODE_GUIDE.md)** - Theme system and customization
- **[Accessibility Guide](ACCESSIBILITY_IMPLEMENTATION.md)** - WCAG 2.1 compliance features
- **[Auto-updater Guide](AUTO_UPDATER_GUIDE.md)** - Automatic update configuration
- **[Security Guide](SECURITY_IMPLEMENTATION.md)** - Security features and configuration

### Deployment & Infrastructure
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment options
- **[Build Guide](BUILD_MODERNIZATION.md)** - Modern build system
- **[Container Guide](kubernetes/)** - Docker and Kubernetes deployment
- **[CI/CD Guide](.github/workflows/)** - GitHub Actions workflows

### Additional Resources
- **[Stingray Documentation](https://docs.stingray.science/)** - Core analysis library
- **[HENDRICS Documentation](https://hendrics.stingray.science/)** - High-energy data reduction

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

We welcome contributions! Here's how to get involved:

### Communication Channels
- 💬 **Slack**: [Join our workspace](http://slack-invite.timelabtechnologies.com)
- 📧 **Email**: info@timelabtechnologies.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/StingraySoftware/dave/issues)
- 📋 **JIRA**: [Project board](https://timelabdev.com/jira/projects/DAVE)
- 📖 **Wiki**: [Confluence docs](https://timelabdev.com/wiki/display/DAVE/Source+code+and+communication)

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for detailed contribution guidelines.

## License

DAVE is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Stingray development team for the core analysis library
- All contributors who have helped improve DAVE
- The astronomical community for valuable feedback

---

<p align="center">
  Made with ❤️ by the <a href="https://github.com/StingraySoftware">StingRay Software</a> team
</p>
