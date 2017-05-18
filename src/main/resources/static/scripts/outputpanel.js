function OutputPanel (id, classSelector, container, service, onFiltersChangedFromPlotFn, getFiltersFn) {

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.service = service;
  this.onFiltersChangedFromPlot = onFiltersChangedFromPlotFn;
  this.getFilters = getFiltersFn;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();
  this.$btnShowToolbar = this.$html.find(".btnShowToolbar");
  this.$btnHideToolbar = this.$html.find(".btnHideToolbar");
  this.$toolBar = this.$html.find(".outputPanelToolBar");
  this.$body =  this.$html.find(".outputPanelBody");
  this.plots = [];
  this.infoPanel = null;
  this.showBlockingLoadDialog = false;

  //METHODS AND EVENTS

  this.$btnShowToolbar.click(function(event){
     currentObj.$btnShowToolbar.hide();
     currentObj.$toolBar.show();
  });

  this.$btnHideToolbar.click(function(event){
     currentObj.$toolBar.hide();
     currentObj.$btnShowToolbar.show();
  });

  this.$btnShowToolbar.hide();
  this.$toolBar.hide();

  this.initPlots = function(projectConfig) {
    //PLOTS HARDCODED BY THE MOMENT HERE
    if (!isNull(projectConfig.schema["RATE"])) {

      //If fits is a Lightcurve
      if (projectConfig.plots.length == 0) {
        this.addLightcurveAndPdsPlots ("SRC",
                                      projectConfig.filename, "", "",
                                      "RATE", "RATE", projectConfig,
                                      "fullWidth", false);
      }

      this.plots = projectConfig.plots;

    } else {

      //If fits is an Events fits
      this.plots = this.getFitsTablePlots(projectConfig.filename,
                                          projectConfig.bckFilename,
                                          projectConfig.gtiFilename,
                                          projectConfig.timeUnit,
                                          projectConfig);
    }

    //ADDS PLOTS TO PANEL
    for (i in this.plots) {
      this.$body.append(this.plots[i].$html);
      if (i > 0) { //TODO: Change this condition...
        this.plots[i].hide();
      }
    };
    this.forceResize();
    this.enableDragDrop(false);
    this.$btnShowToolbar.show();

    setTimeout( function () {
      //Forces check if all plots visible are ready.
      //If all plots are hidden no PlotReady event is rised from plots
      currentObj.onPlotReady();
    }, 2500);

  };

  this.resize = function() {
    for (i in this.plots) { this.plots[i].resize(); };
  }

  this.forceResize = function () {
    $(window).trigger("resize");
  }

  this.onDatasetChanged = function ( projectConfig ) {

    // Clears output panel
    this.$body.html("");
    this.$toolBar.find(".container").html("");

    // Adds plots
    this.initPlots(projectConfig);

    // Adds FITS info if found
    if (!isNull(projectConfig.schema["EVENTS"])) {
      this.addInfoPanel( "EVENTS HEADER:", "EVENTS", projectConfig.schema );
    } else if (!isNull(projectConfig.schema["RATE"])) {
      this.addInfoPanel( "LIGHTCURVE HEADER:", "RATE", projectConfig.schema );
    }
  }

  this.addInfoPanel = function ( title, tableName, schema ) {
    if (!isNull(schema[tableName]["HEADER"])) {
      this.infoPanel = new InfoPanel("infoPanel", title, schema[tableName]["HEADER"], schema[tableName]["HEADER_COMMENTS"], this.$toolBar);
      this.$body.append(this.infoPanel.$html);
    }
  }

  this.onDatasetValuesChanged = function ( filters ) {
    if (this.showBlockingLoadDialog){
      waitingDialog.show('Retrieving plots data...');
    } else {
      waitingDialog.hide();
    }

    if (isNull(filters)) {
      filters = this.getFilters();
    }
    log("onDatasetValuesChanged: filters: " + JSON.stringify( filters ) );
    for (i in this.plots) { this.plots[i].onDatasetValuesChanged( filters ); };

    setTimeout(this.onPlotReady, 500);
  }

  this.onPlotReady = function () {
    for (i in currentObj.plots) { if (currentObj.plots[i].isVisible && !currentObj.plots[i].isReady) return; };
    if (this.showBlockingLoadDialog){
      waitingDialog.hide();
    }
  }

  this.enableDragDrop = function (enabled) {
    if (isNull(this.dragDropEnabled)) {
      currentObj.$body.sortable({ revert: true });
    }

    this.dragDropEnabled = enabled;
    currentObj.$body.sortable( "option", "disabled", !this.dragDropEnabled );
  }

  this.containsId = function (id) {
    return (this.id == id) || this.getPlotById(id) != null;
  }

  this.getPlotById = function (id) {
    for (i in this.plots) {
      if (this.plots[i].id == id) {
          return this.plots[i];
      }
    }
    return null;
  }

  this.generatePlotId = function (id) {
    return (this.id + "_" + id + "_" + (new Date()).getTime()).replace(/\./g,'');
  }

  this.broadcastEventToPlots = function (evt_name, evt_data, senderId) {
    for (i in this.plots) {
      this.plots[i].receivePlotEvent(evt_name, evt_data, senderId);
    }
  }

  //RETURN THE PLOTS ARRAY FOR AN EVENTS FITS
  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, timeUnit, projectConfig ) {

    log("getFitsTablePlots: filename: " + filename );

    baLcPlot = this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "B/A Color Ratio"],
                                        "B/A LC",
                                        [], "fullWidth", false );
    baLcPlot.getDataFromServerFn = null; //Disable calls to server

    dcLcPlot = this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "D/C Color Ratio"],
                                        "D/C LC",
                                        [], "fullWidth", false );
    dcLcPlot.getDataFromServerFn = null; //Disable calls to server

    return [
              this.getLightCurvePlot ( filename,
                                      bck_filename,
                                      gti_filename,
                                      "EVENTS",
                                      ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"],
                                      "SRC LC",
                                      [], "fullWidth", false ),

              baLcPlot,

              dcLcPlot,

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["D/C Color Ratio(c/s)", "B/A Color Ratio(c/s)"], "Color-Color Diagram",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "fullWidth", true ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["Total Count Rate (c/s)", "B/A Color Ratio(c/s)"], "Softness Intensity Diagram",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" } ],
                                                        "", true, baLcPlot ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["Total Count Rate (c/s)", "D/C Color Ratio(c/s)"], "Hardness Intensity Diagram",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "", true, dcLcPlot ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "fullWidth", "SRC PDS" ),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "A Count Rate(c/s)"],
                                        "A LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumnInPlot: true } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "A PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumnInPlot: true } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "B Count Rate(c/s)"],
                                        "B LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumnInPlot: true } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "B PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumnInPlot: true } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "C Count Rate(c/s)"],
                                        "C LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumnInPlot: true } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "C PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumnInPlot: true } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "D Count Rate(c/s)"],
                                        "D LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumnInPlot: true } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "D PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumnInPlot: true } ]),

              this.getDynamicalSpectrumPlot ( projectConfig,
                                              filename,
                                              bck_filename,
                                              gti_filename,
                                              "EVENTS", "PHA", "fullScreen", "SRC DYNAMICAL SPECTRUM" ),

              this.getPlot (this.id + "_phaVsCounts_" + filename,
                            filename, bck_filename, gti_filename,
                            { type: "2d",
                              labels: ["Channel", "Counts"],
                              title: "Channel counts" },
                            [ { table: "EVENTS", column:"PHA" } ],
                            this.service.request_histogram, "")
          ];
  }

  this.getPlot = function (id, filename, bck_filename, gti_filename, styles, axis, fn, cssClass) {
    return new Plot(
              id,
              {
                filename: filename,
                bck_filename: bck_filename,
                gti_filename: gti_filename,
                styles: styles,
                axis: axis
              },
              (isNull(fn)) ? this.service.request_plot_data : fn,
              this.onFiltersChangedFromPlot,
              this.onPlotReady,
              this.$toolBar,
              (isNull(cssClass)) ? "fullWidth" : cssClass,
              false
            );
  }

  this.getLightCurvePlot = function ( filename, bck_filename, gti_filename, tableName, labels, title, mandatoryFilters, cssClass, switchable ) {

    log("getLightCurvePlot: filename: " + filename );
    return new LcPlot(
                      this.generatePlotId("ligthcurve_" + filename),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: labels,
                                  title: title,
                                  selectable: true
                                },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:"PHA" } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_lightcurve,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.getJoinedLightCurvesPlot = function ( lc0_filename, lc1_filename, labels, title, cssClass, switchable ) {

    log("getJoinedLightCurvesPlot: lc0_filename: " + lc0_filename + ", lc0_filename: " + lc1_filename);
    return new Plot(
                      this.generatePlotId("ligthcurve_" + lc0_filename + "_" + lc1_filename),
                      {
                        lc0_filename: lc0_filename,
                        lc1_filename: lc1_filename,
                        styles: { type: "scatter", labels: labels, title: title },
                        axis: [ { table: "RATE", column:"TIME" },
                                { table: "RATE", column:"PHA" } ]
                      },
                      this.service.request_joined_lightcurves,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.getJoinedLightCurvesFromColorsPlot = function ( filename, bck_filename, gti_filename, tableName, labels, title, mandatoryFilters, cssClass, switchable, linkedPlot ) {

    log("getJoinedLightCurvesFromColorsPlot: filename: " + filename );
    var id = this.generatePlotId("joinedLcByColors_" + filename);
    if (!isNull(linkedPlot)) {
      linkedPlot.parentPlotId = id;
    }
    return new Plot(
                      id,
                      {
                        id: id,
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "scatter", labels: labels, title: title },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:"PHA" } ],
                        mandatoryFilters: mandatoryFilters,
                        linkedPlotId: (isNull(linkedPlot)) ? null : linkedPlot.id
                      },
                      (isNull(linkedPlot)) ? this.service.request_divided_lightcurves_from_colors : this.getDividedLightCurvesFromColorsDataFromServer,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.getPDSPlot = function ( projectConfig, filename, bck_filename, gti_filename, tableName, columnName, cssClass, title, mandatoryFilters ) {

    log("getPDSPlot: filename: " + filename );
    return new PDSPlot(
                      this.generatePlotId("pds_" + filename),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: ["Frequency (Hz)", "Power"],
                                  title: title,
                                  showFitBtn: true },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_power_density_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      false,
                      projectConfig
                    );
  }

  this.getDynamicalSpectrumPlot = function ( projectConfig, filename, bck_filename, gti_filename, tableName, columnName, cssClass, title, mandatoryFilters ) {

    log("getDynamicalSpectrumPlot: filename: " + filename );
    return new DynSpPlot(
                      this.generatePlotId("dynX_" + filename),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "surface",
                                  labels: ["Frequency (Hz)", "Time (s)", "Power"],
                                  title: title,
                                  showPdsType: false
                                },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_dynamical_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      false,
                      projectConfig
                    );
  }

  this.tryAddDividedLightCurve = function (key0, key1, newKeySufix, projectConfig) {
    var data = {};
    data.lc0_filename = projectConfig.getFile(key0);
    data.lc1_filename = projectConfig.getFile(key1);

    var newKey = "LC_" + newKeySufix;

    if ((data.lc0_filename != "") && (data.lc1_filename != "") && (projectConfig.getFile(newKey) == "")){

      //Prepares newKey from divided lcs dataset and adds the plot to output panel
      currentObj.service.request_divided_lightcurve_ds(data, function (result) {
        var cache_key = JSON.parse(result);
        log("request_divided_lightcurve_ds Result: " + newKey + " --> " + cache_key);
        if (cache_key != "") {

          projectConfig.setFile(newKey, cache_key);
          currentObj.addLightcurveAndPdsPlots (newKeySufix, cache_key, "", "", "RATE", "PHA", projectConfig);

          //After getting A/B or C/D we can calculate the Hardness and Softnes Intensity lcs
          if ((newKeySufix == "B/A") || (newKeySufix == "D/C")) {

            joined_lc_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("SRC"),
                                                                      cache_key,
                                                                      ["Total Count Rate (c/s)", newKeySufix + " Color Ratio"],
                                                                      ((newKeySufix == "B/A") ? "Softness Intensity Diagram" : "Hardness Intensity Diagram"),
                                                                      "", true);
            projectConfig.plots.push(joined_lc_plot);
            currentObj.appendPlot(joined_lc_plot);

            //After getting A/B and C/D we can calculate the color to color plot
            if ((projectConfig.getFile("LC_B/A") != "")
                  && (projectConfig.getFile("LC_D/C") != "")){

                var abcd_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("LC_B/A"),
                                                                      projectConfig.getFile("LC_D/C"),
                                                                      ["B/A Color Ratio(c/s)", "D/C Color Ratio"],
                                                                      "Color-Color Diagram", "", true);
                projectConfig.plots.push(abcd_plot);
                currentObj.appendPlot(abcd_plot);
            }
          }
        } else {
          log("request_divided_lightcurve_ds WRONG CACHE KEY!!");
        }
      });

      return true;
    }

    return false;
  }

  this.addLightcurveAndPdsPlots = function (titlePrefix, filename, bck_filename, gti_filename, tableName, columnName, projectConfig, cssClass, refreshData){
    var mustRefreshData = isNull(refreshData) || refreshData;

    var yLabel = ((titlePrefix == "B/A") || (titlePrefix == "D/C")) ? "Color Ratio" : "Count Rate(c/s)";

    var lc_plot = currentObj.getLightCurvePlot ( filename, bck_filename, gti_filename,
                                                tableName,
                                                ["TIME (" + projectConfig.timeUnit  + ")", yLabel],
                                                titlePrefix + " LC",
                                                [], cssClass, false);
    projectConfig.plots.push(lc_plot);
    currentObj.appendPlot(lc_plot, mustRefreshData);

    var pds_plot = null;
    if ((titlePrefix != "B/A") && (titlePrefix != "D/C")) {
      pds_plot = this.getPDSPlot ( projectConfig, filename, bck_filename, gti_filename,
                                      tableName, columnName, cssClass, titlePrefix + " PDS" );
      pds_plot.plotConfig.styles.title = titlePrefix + " PDS";
      projectConfig.plots.push(pds_plot);
      currentObj.appendPlot(pds_plot, mustRefreshData);
    }

    if (titlePrefix == "SRC") {
      var dynamical_plot = this.getDynamicalSpectrumPlot ( projectConfig,
                                                          filename,
                                                          bck_filename,
                                                          gti_filename,
                                                          tableName, columnName, "fullScreen", titlePrefix + " DYNAMICAL SPECTRUM" );
      projectConfig.plots.push(dynamical_plot);
      currentObj.appendPlot(dynamical_plot, mustRefreshData);

      return [lc_plot, pds_plot, dynamical_plot];
    } else {

      return [lc_plot, pds_plot];
    }
  }

  this.addRmfPlots = function (projectConfig){

    var covarianceSpectrumPlot = new CovariancePlot(
                                      this.generatePlotId("covarianceSpectrum_" + projectConfig.filename),
                                      {
                                        filename: projectConfig.filename,
                                        bck_filename: projectConfig.bckFilename,
                                        gti_filename: projectConfig.gtiFilename,
                                        styles:{ type: "2d",
                                                 labels: ["Energy(keV)", "Covariance"],
                                                 title: "Covariance Spectrum" }
                                      },
                                      this.service.request_covariance_spectrum,
                                      this.onFiltersChangedFromPlot,
                                      this.onPlotReady,
                                      this.$toolBar,
                                      "fullWidth",
                                      false,
                                      projectConfig
                                    );
    this.plots.push(covarianceSpectrumPlot);
    this.appendPlot(covarianceSpectrumPlot, true);

    var rmsPlot = this.getRMSPlot ( projectConfig,
                        projectConfig.filename,
                        projectConfig.bckFilename,
                        projectConfig.gtiFilename,
                        "EVENTS", "PHA", "fullWidth", "RMS vs Energy" )
    this.plots.push(rmsPlot);
    this.appendPlot(rmsPlot, true);

    /*var rmfPlot = this.getPlot (this.generatePlotId("rmf_" + projectConfig.rmfFilename),
                                projectConfig.rmfFilename, "", "",
                                { type: "2d",
                                  labels: ["Channel", "Energy (keV)"],
                                  title: "RMF" },
                                [ { table: "EBOUNDS", column:"CHANNEL" },
                                  { table: "EBOUNDS", column:"E_MIN" } ],
                                null, "");

    this.plots.push(rmfPlot);
    this.appendPlot(rmfPlot, true);*/

    this.tryAddEnergyAndUnfoldedSpectrumPlot(projectConfig);
  }

  this.addArfPlots = function (projectConfig){
    /*var arfPlot = this.getPlot (this.generatePlotId("arf_" + projectConfig.arfFilename),
                                projectConfig.arfFilename, "", "",
                                { type: "2d",
                                  labels: ["Energy (keV)", "Effective area (cm^2)"],
                                  title: "ARF" },
                                [ { table: "SPECRESP", column:"ENERG_LO" },
                                  { table: "SPECRESP", column:"SPECRESP" } ],
                                null, "");

    this.plots.push(arfPlot);
    this.appendPlot(arfPlot, true);*/

    this.tryAddEnergyAndUnfoldedSpectrumPlot(projectConfig);
  }

  this.tryAddEnergyAndUnfoldedSpectrumPlot = function (projectConfig) {

    if ((projectConfig.filename != "") && (projectConfig.arfFilename != "") && (projectConfig.rmfFilename != "")){

      var energySpectrumPlot = new Plot(
                                this.generatePlotId("energySpectrum_" + projectConfig.filename),
                                {
                                  filename: projectConfig.filename,
                                  bck_filename: projectConfig.bckFilename,
                                  gti_filename: projectConfig.gtiFilename,
                                  arf_filename: projectConfig.arfFilename,
                                  styles:{ type: "2d",
                                           labels: ["Energy(keV)", "Counts s^-1 keV^-1"],
                                           title: "Energy Spectrum" }
                                },
                                currentObj.getUnfoldedSpectrumDataFromServer,
                                currentObj.onFiltersChangedFromPlot,
                                currentObj.onPlotReady,
                                currentObj.$toolBar,
                                "fullWidth",
                                false
                              );

      energySpectrumPlot.plotConfig.xAxisType = "log";
      energySpectrumPlot.plotConfig.yAxisType = "log";
      currentObj.energySpectrumPlotIdx = currentObj.plots.length;
      currentObj.plots.push(energySpectrumPlot);
      currentObj.appendPlot(energySpectrumPlot, true);

      /*var unfoldedSpectrumPlot = new Plot(
                                this.generatePlotId("unfoldedSpectrum_" + projectConfig.filename),
                                {
                                  styles:{ type: "2d",
                                           labels: ["Energy(keV)", "Ph s^-1 cm^-2 keV^-1"],
                                           title: "Unfolded Spectrum" }
                                },
                                null,
                                currentObj.onFiltersChangedFromPlot,
                                currentObj.onPlotReady,
                                currentObj.$toolBar,
                                "",
                                false
                              );

      unfoldedSpectrumPlot.plotConfig.xAxisType = "log";
      unfoldedSpectrumPlot.plotConfig.yAxisType = "log";
      currentObj.unfoldedSpectrumPlotIdx = currentObj.plots.length;
      currentObj.plots.push(unfoldedSpectrumPlot);
      currentObj.appendPlot(unfoldedSpectrumPlot, false);*/

      return true;
    }

    return false;
  }

  this.getDividedLightCurvesFromColorsDataFromServer = function (paramsData, fn) {

    log("OutputPanel getDividedLightCurvesFromColorsDataFromServer...");

    currentObj.service.request_divided_lightcurves_from_colors(paramsData, function( jsdata ) {
      data = JSON.parse(jsdata);

      var joinedLcPlot = currentObj.getPlotById(paramsData.id);
      joinedLcPlot.setData((!isNull(data)) ? $.extend(true, [], [ data[0], data[1] ]) : null);

      if (!isNull(paramsData.linkedPlotId)) {
        var joinedLcTimePlot = currentObj.getPlotById(paramsData.linkedPlotId);
        joinedLcTimePlot.setData((!isNull(data)) ? $.extend(true, [], [ data[2], data[1], [], data[3], data[4] ]) : null);
      }
    });

  };

  this.getUnfoldedSpectrumDataFromServer = function (paramsData, fn) {

    log("OutputPanel getUnfoldedSpectrumDataFromServer...");

    currentObj.service.request_unfolded_spectrum(paramsData, function( jsdata ) {
      data = JSON.parse(jsdata);

      if (data == null) {
        log("request_unfolded_spectrum data null, outputPanel: " + currentObj.id);
        return;

      } else {

        var energySpectrumPlot = currentObj.plots[currentObj.energySpectrumPlotIdx];
        if (energySpectrumPlot.isVisible) {
          energySpectrumPlot.setData($.extend(true, [], [ data[0], data[1] ]));
        }

        /*var unfoldedSpectrumPlot = currentObj.plots[currentObj.unfoldedSpectrumPlotIdx];
        if (unfoldedSpectrumPlot.isVisible) {
          unfoldedSpectrumPlot.setData($.extend(true, [], [ data[0], data[2] ]));
        }*/

      }
    });

  };

  this.getRMSPlot = function ( projectConfig, filename, bck_filename, gti_filename, tableName, columnName, cssClass, title, mandatoryFilters ) {

    log("getRMSPlot: filename: " + filename );
    return new RmsPlot(
                      this.generatePlotId("rms_" + filename),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: ["Energy(keV)", "RMS"],
                                  title: title,
                                  showFitBtn: true },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_rms_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      false,
                      projectConfig
                    );
  }

  this.appendPlot = function (plot, refreshData) {
    this.$body.append(plot.$html);
    if (isNull(refreshData) || refreshData) {
      plot.onDatasetValuesChanged(this.getFilters());
    }
  }

  log ("Output panel ready!!");
 }
