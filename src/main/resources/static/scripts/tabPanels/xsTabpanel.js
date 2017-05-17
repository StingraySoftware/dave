
//Adds new Cross Spectrum Tab Panel
function addXdTabPanel(navBarList, panelContainer, plots, projectConfigs){
  tab = new XSTabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer, plots, projectConfigs);
}

function XSTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plots, projectConfigs) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  TabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //XSTabPanel METHODS:

  this.getXSDataFromServer = function (paramsData, fn) {

    log("XSTabPanel getXSDataFromServer...");

    currentObj.service.request_cross_spectrum(paramsData, function( jsdata ) {

      log("XSData received!, XSTabPanel: " + currentObj.id);
      data = JSON.parse(jsdata);

      if (data == null) {
        log("onPlotReceived wrong data!, XSTabPanel: " + currentObj.id);
        return;

      } else {

        //Prepares Cross Spectrum Plot data and sends it to xsPlot
        var xsPlot = currentObj.outputPanel.plots[currentObj.xsPlotIdx];
        if (xsPlot.isVisible) {
          //PDSPlot Params req: freq, power, duration, warnmsg
          //Clones array data for allowing changes on data withot affecting othe plotsdata
          xsPlot.setData($.extend(true, [], [ data[0], data[1], data[4], data[5] ]));
        }

        //Prepares TimeLag Plot data and sends it to timeLagPlot
        var timeLagPlot = currentObj.outputPanel.plots[currentObj.timeLagPlotIdx];
        if (timeLagPlot.isVisible) {
          //Lightcurve Params req: freq, time_lag, error_values, gti_start, gti_stop
          timeLagPlot.setData($.extend(true, [], [ data[0], { values: data[2].values[0] }, { values: data[2].values[1] }, [], [] ]));
        }

        //Prepares Coherence Plot data and sends it to coherencePlot
        var coherencePlot = currentObj.outputPanel.plots[currentObj.coherencePlotIdx];
        if (coherencePlot.isVisible) {
          //ColorLc Params req: freq, color_A, color_B, gti_start, gti_stop
          coherencePlot.setData($.extend(true, [], [ data[0], { values: data[3].values[0] }, { values: data[3].values[1] }, [], [] ]));
        }

      }
    });

  };

  this.addPlot = function (plot){
    this.outputPanel.plots.push(plot);
    this.projectConfig.plots.push(plot);
    this.outputPanel.appendPlot(plot);
  };


  //Set the selected plot configs
  this.plots = plots;
  this.xsPlotIdx = -1;
  this.timeLagPlotIdx = -1;
  this.coherencePlotIdx = -1;

  this.projectConfig.updateFromProjectConfigs(projectConfigs);

  this.setTitle("XSpectrum");

  //Preapares XS toolpanel data
  this.toolPanel.clearFileSelectors();
  for (i in this.plots){
    var plot = this.plots[i];
    var label = isNull(plot.plotConfig.styles.title) ? "File " + i + ":" : plot.plotConfig.styles.title;
    this.toolPanel.addSelectedFile(label, plot.plotConfig.filename);
  }

  if (this.plots.length == 2) {

    //Adds Cross Spectrum Plot to outputPanel
    var xsPlot = new PDSPlot(
                              this.id + "_xs_" + (new Date()).getTime(),
                              {
                                filename1: this.plots[0].plotConfig.filename,
                                bck_filename1: this.plots[0].plotConfig.bck_filename,
                                gti_filename1: this.plots[0].plotConfig.gti_filename,
                                filters1: this.plots[0].plotConfig.filters,
                                axis1: this.plots[0].plotConfig.axis,
                                dt1: this.plots[0].plotConfig.dt,

                                filename2: this.plots[1].plotConfig.filename,
                                bck_filename2: this.plots[1].plotConfig.bck_filename,
                                gti_filename2: this.plots[1].plotConfig.gti_filename,
                                filters2: this.plots[1].plotConfig.filters,
                                axis2: this.plots[1].plotConfig.axis,
                                dt2: this.plots[1].plotConfig.dt,

                                styles: { type: "ligthcurve",
                                          labels: ["Frequency (Hz)", "Power"],
                                          title: "XSpectrum" }
                              },
                              this.getXSDataFromServer, //Only XSpectra plot triggers receive new data from server
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "fullWidth",
                              false,
                              this.projectConfig
                            );

    this.xsPlotIdx = this.outputPanel.plots.length;
    this.addPlot(xsPlot);


    //Adds Cross Spectrum Plot to outputPanel
    var timeLagPlot = new LcPlot(
                              this.id + "_timelag_" + (new Date()).getTime(),
                              {
                                styles: { type: "ligthcurve",
                                          labels: ["Frequency (Hz)", "Time(s)"],
                                          title: "TimeLag" }
                              },
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );

    this.timeLagPlotIdx = this.outputPanel.plots.length;
    this.addPlot(timeLagPlot);


    //Adds Cross Spectrum Plot to outputPanel
    var coherencePlot = new LcPlot(
                              this.id + "_coherence_" + (new Date()).getTime(),
                              {
                                styles: { type: "ligthcurve",
                                          labels: ["Frequency (Hz)", "Coherence"],
                                          title: "Coherence" },
                              },
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );

    this.coherencePlotIdx = this.outputPanel.plots.length;
    this.addPlot(coherencePlot);

  }

  log("XSTabPanel ready! id: " + this.id);
}
