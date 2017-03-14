
//Adds new Cross Spectrum Tab Panel
function addXdTabPanel(navBarList, panelContainer, plots){
  tab = new XSTabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer, plots);
}

function XSTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plots) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  TabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //Set the selected plot configs
  this.plots = plots;

  this.setTitle("XSpectrum");

  //Preapares XS toolpanel data
  this.toolPanel.clearFileSelectors();
  for (i in this.plots){
    var plot = this.plots[i];
    this.toolPanel.addSelectedFile(plot.plotConfig.styles.title, plot.plotConfig.filename);
  }

  if (this.plots.length == 2) {
    var xsPlot = new PDSPlot(
                              this.id + "_xs_" + (new Date()).getTime(),
                              {
                                filename1: this.plots[0].plotConfig.filename,
                                bck_filename1: this.plots[0].plotConfig.bck_filename,
                                gti_filename1: this.plots[0].plotConfig.gti_filename,
                                filters1: this.plots[0].plotConfig.filters,
                                axis1: [{"table":"RATE","column":"TIME"},
                                        {"table":"RATE","column":"RATE"}], //this.plots[0].plotConfig.axis,
                                dt1: this.plots[0].plotConfig.dt,

                                filename2: this.plots[1].plotConfig.filename,
                                bck_filename2: this.plots[1].plotConfig.bck_filename,
                                gti_filename2: this.plots[1].plotConfig.gti_filename,
                                filters2: this.plots[1].plotConfig.filters,
                                axis2: [{"table":"RATE","column":"TIME"},
                                        {"table":"RATE","column":"RATE"}], //this.plots[1].plotConfig.axis,
                                dt2: this.plots[1].plotConfig.dt,

                                styles: { type: "ligthcurve",
                                          labels: ["Frequency", "Power"],
                                          title: "XSpectrum" }
                              },
                              this.service.request_cross_spectrum,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              this.outputPanel.$toolBar,
                              "fullWidth",
                              false
                            );

    this.outputPanel.plots.push(xsPlot);
    this.projectConfig.plots.push(xsPlot);
    this.outputPanel.appendPlot(xsPlot);
  }

  log("XSTabPanel ready! id: " + this.id);
}
