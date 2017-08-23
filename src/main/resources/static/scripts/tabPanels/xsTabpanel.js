
//Adds new Cross Spectrum Tab Panel
function addXdTabPanel(navBarList, panelContainer, plotConfigs, projectConfigs, id, navItemClass){
  return new XSTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService, navBarList, panelContainer, plotConfigs, projectConfigs);
}

function XSTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfigs, projectConfigs) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //XSTabPanel METHODS:

  this.getXSDataFromServer = function (paramsData, fn) {

    log("XSTabPanel getXSDataFromServer...");

    if (!isNull(currentObj.currentRequest) && !isNull(currentObj.currentRequest.abort)) {
      currentObj.currentRequest.abort();
    }

    var timeLagPlot = currentObj.outputPanel.plots[currentObj.timeLagPlotIdx];
    if (timeLagPlot.isVisible) {
      timeLagPlot.setReadyState(false);
    }

    var coherencePlot = currentObj.outputPanel.plots[currentObj.coherencePlotIdx];
    if (coherencePlot.isVisible) {
      coherencePlot.setReadyState(false);
    }

    currentObj.currentRequest = currentObj.service.request_cross_spectrum(paramsData, function( jsdata ) {

      if (!isNull(jsdata.abort)){
        log("Current request aborted, XSTabPanel: " + currentObj.id);
        return; //Comes from request abort call.
      }

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

  this.getConfig = function () {
    return { type: "XSTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             plotConfigs: this.plotConfigs,
             projectConfig: this.projectConfig.getConfig(),
             outputPanelConfig: this.outputPanel.getConfig()
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.createPlots();
    this.outputPanel.setConfig(tabConfig.outputPanelConfig);

    callback();
  }

  this.createPlots = function () {
    if (this.plotConfigs.length == 2) {

      //Adds Cross Spectrum Plot to outputPanel
      var xsPlot = new PDSPlot(
                                this.id + "_xs_" + (new Date()).getTime(),
                                {
                                  filename1: this.plotConfigs[0].filename,
                                  bck_filename1: this.plotConfigs[0].bck_filename,
                                  gti_filename1: this.plotConfigs[0].gti_filename,
                                  filters1: this.plotConfigs[0].filters,
                                  axis1: this.plotConfigs[0].axis,
                                  dt1: this.plotConfigs[0].dt,

                                  filename2: this.plotConfigs[1].filename,
                                  bck_filename2: this.plotConfigs[1].bck_filename,
                                  gti_filename2: this.plotConfigs[1].gti_filename,
                                  filters2: this.plotConfigs[1].filters,
                                  axis2: this.plotConfigs[1].axis,
                                  dt2: this.plotConfigs[1].dt,

                                  styles: { type: "ligthcurve",
                                            labels: ["Frequency (Hz)", "Power"],
                                            title: "Cross Spectrum" }
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
      this.addPlot(xsPlot, false);


      //Adds TimeLag Plot to outputPanel
      var timeLagPlot = new TimingPlot(
                                this.id + "_timelag_" + (new Date()).getTime(),
                                {
                                  styles: { type: "ligthcurve",
                                            labels: ["Frequency (Hz)", "Time(s)"],
                                            title: "Frequency Lag" }
                                },
                                null,
                                this.outputPanel.onFiltersChangedFromPlot,
                                this.outputPanel.onPlotReady,
                                null,
                                "",
                                false
                              );
      this.timeLagPlotIdx = this.outputPanel.plots.length;
      this.addPlot(timeLagPlot, false);


      //Adds Coherence Plot to outputPanel
      var coherencePlot = new TimingPlot(
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
      this.addPlot(coherencePlot, false);

      //Request plot data after all plots were added
      xsPlot.onDatasetValuesChanged(this.outputPanel.getFilters());
    }
  }

  //Set the selected plot configs
  this.plotConfigs = plotConfigs;
  this.xsPlotIdx = -1;
  this.timeLagPlotIdx = -1;
  this.coherencePlotIdx = -1;

  this.setTitle("XSpectrum");

  //Preapares XS toolpanel data
  this.toolPanel.clearFileSelectors();
  for (i in this.plotConfigs){
    var plotConfig = this.plotConfigs[i];
    var label = isNull(plotConfig.styles.title) ? "File " + i + ":" : plotConfig.styles.title;
    this.toolPanel.addSelectedFile(label, getFilename(plotConfig.filename));
  }

  if (projectConfigs.length > 0){
    this.projectConfig.updateFromProjectConfigs(projectConfigs);
    this.createPlots();
  }

  log("XSTabPanel ready! id: " + this.id);
}
