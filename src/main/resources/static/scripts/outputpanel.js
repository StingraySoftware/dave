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
  this.$toolBar = this.$html.find(".outputPanelToolBar");
  this.$body =  this.$html.find(".outputPanelBody");
  this.plots = [];


  //METHODS AND EVENTS
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
      if (i > 5) {
        this.plots[i].hide();
      }
    };
    this.forceResize();
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
    this.$toolBar.html("");

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
      var theInfoPanel = new infoPanel("infoPanel", title, schema[tableName]["HEADER"], schema[tableName]["HEADER_COMMENTS"], this.$toolBar);
      this.$body.append(theInfoPanel.$html);
    }
  }

  this.onDatasetValuesChanged = function ( filters ) {
    waitingDialog.show('Retrieving plots data...');

    if (isNull(filters)) {
      filters = this.getFilters();
    }
    log("onDatasetValuesChanged: filters: " + JSON.stringify( filters ) );
    for (i in this.plots) { this.plots[i].onDatasetValuesChanged( filters ); };
  }

  this.onPlotReady = function () {
    for (i in currentObj.plots) { if (!currentObj.plots[i].isReady) return; };
    currentObj.$body.sortable({ revert: true });
    waitingDialog.hide();
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

  this.broadcastEventToPlots = function (evt_name, evt_data, senderId) {
    for (i in this.plots) {
      this.plots[i].receivePlotEvent(evt_name, evt_data, senderId);
    }
  }

  //RETURN THE PLOTS ARRAY FOR AN EVENTS FITS
  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, timeUnit, projectConfig ) {

    log("getFitsTablePlots: filename: " + filename );

    baLcPlot = this.getLightCurvePlot ( "", "", "", "EVENTS",
                                      ["TIME (" + timeUnit  + ")", "B/A Color Ratio"],
                                      "B/A LC",
                                      [], "fullWidth", false );
    baLcPlot.getDataFromServerFn = null;

    dcLcPlot = this.getLightCurvePlot ( "", "", "", "EVENTS",
                                      ["TIME (" + timeUnit  + ")", "D/C Color Ratio"],
                                      "D/C LC",
                                      [], "fullWidth", false );
    dcLcPlot.getDataFromServerFn = null;

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
                                                        ["D/C Count Rate(c/s)", "B/A Count Rate(c/s)"], "D/C vs B/A",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "fullWidth", true ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["SRC Count Rate", "B/A Count Rate(c/s)"], "B/A vs SRC",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" } ],
                                                        "", true, baLcPlot.id ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["SRC Count Rate", "D/C Count Rate(c/s)"], "D/C vs SRC",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "", true, dcLcPlot.id ),

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
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumn: "PHA" } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "A PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumn: "PHA" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "B Count Rate(c/s)"],
                                        "B LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumn: "PHA" } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "B PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumn: "PHA" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "C Count Rate(c/s)"],
                                        "C LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumn: "PHA" } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "C PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumn: "PHA" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit + ")", "D Count Rate(c/s)"],
                                        "D LC",
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumn: "PHA" } ],
                                        "", false ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PHA", "", "D PDS",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumn: "PHA" } ]),

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
    return new Plot(
                      this.id + "_ligthcurve_" + filename + "_" + (new Date()).getTime(),
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

  this.getJoinedLightCurvesPlot = function ( lc0_filename, lc1_filename, labels, cssClass, switchable ) {

    log("getJoinedLightCurvesPlot: lc0_filename: " + lc0_filename + ", lc0_filename: " + lc1_filename);
    return new Plot(
                      this.id + "_ligthcurve_" + lc0_filename + "_" + lc1_filename + "_" + (new Date()).getTime(),
                      {
                        lc0_filename: lc0_filename,
                        lc1_filename: lc1_filename,
                        styles: { type: "scatter", labels: labels },
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

  this.getJoinedLightCurvesFromColorsPlot = function ( filename, bck_filename, gti_filename, tableName, labels, title, mandatoryFilters, cssClass, switchable, linkedPlotId ) {

    log("getJoinedLightCurvesFromColorsPlot: filename: " + filename );
    var id = (this.id + "_joinedLcByColors_" + filename + "_" + (new Date()).getTime()).replace(/\./g,'');
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
                        linkedPlotId: (isNull(linkedPlotId)) ? null : linkedPlotId
                      },
                      (isNull(linkedPlotId)) ? this.service.request_joined_lightcurves_from_colors : this.getJoinedLightCurvesFromColorsDataFromServer,
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
                      this.id + "_pds_" + filename + "_" + (new Date()).getTime(),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve", labels: ["Frequency", "Power"], title: title },
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
                                                                      ["Src Count Rate(c/s)", newKeySufix + " Color Ratio"],
                                                                      "", true);
            projectConfig.plots.push(joined_lc_plot);
            currentObj.appendPlot(joined_lc_plot);

            //After getting A/B and C/D we can calculate the color to color plot
            if ((projectConfig.getFile("LC_B/A") != "")
                  && (projectConfig.getFile("LC_D/C") != "")){

                var abcd_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("LC_B/A"),
                                                                      projectConfig.getFile("LC_D/C"),
                                                                      ["B/A Count Rate(c/s)", "D/C Color Ratio"],
                                                                      "", true);
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

    return [lc_plot, pds_plot];
  }

  this.addRmfPlots = function (projectConfig){
    var rmfPlot = this.getPlot (this.id + "_rmf_" + projectConfig.rmfFilename,
                                projectConfig.rmfFilename, "", "",
                                { type: "2d",
                                  labels: ["CHANNEL", "Energy (keV)"] },
                                [ { table: "EBOUNDS", column:"CHANNEL" },
                                  { table: "EBOUNDS", column:"E_MIN" } ],
                                null, "");

    this.plots.push(rmfPlot);
    this.appendPlot(rmfPlot, true);

    this.tryAddEnergyAndUnfoldedSpectrumPlot(projectConfig);
  }

  this.addArfPlots = function (projectConfig){
    var arfPlot = this.getPlot (this.id + "_arf_" + projectConfig.arfFilename,
                                projectConfig.arfFilename, "", "",
                                { type: "2d",
                                  labels: ["Energy (keV)", "Effective area (cm^2)"] },
                                [ { table: "SPECRESP", column:"ENERG_LO" },
                                  { table: "SPECRESP", column:"SPECRESP" } ],
                                null, "");

    this.plots.push(arfPlot);
    this.appendPlot(arfPlot, true);

    this.tryAddEnergyAndUnfoldedSpectrumPlot(projectConfig);
  }

  this.tryAddEnergyAndUnfoldedSpectrumPlot = function (projectConfig) {

    if ((projectConfig.filename != "") && (projectConfig.arfFilename != "") && (projectConfig.rmfFilename != "")){

      var energySpectrumPlot = new Plot(
                                this.id + "_energySpectrum_" + (new Date()).getTime(),
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
                                "",
                                false
                              );

      energySpectrumPlot.plotConfig.xAxisType = "log";
      energySpectrumPlot.plotConfig.yAxisType = "log";
      currentObj.energySpectrumPlotIdx = currentObj.plots.length;
      currentObj.plots.push(energySpectrumPlot);
      currentObj.appendPlot(energySpectrumPlot, true);

      var unfoldedSpectrumPlot = new Plot(
                                this.id + "_unfoldedSpectrum_" + (new Date()).getTime(),
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
      currentObj.appendPlot(unfoldedSpectrumPlot, false);

      return true;
    }

    return false;
  }

  this.getJoinedLightCurvesFromColorsDataFromServer = function (paramsData, fn) {

    log("OutputPanel getJoinedLightCurvesFromColorsDataFromServer...");

    currentObj.service.request_joined_lightcurves_from_colors(paramsData, function( jsdata ) {
      data = JSON.parse(jsdata);

      var joinedLcPlot = currentObj.getPlotById(paramsData.id);
      if (joinedLcPlot.isVisible) {
        joinedLcPlot.setData((!isNull(data)) ? $.extend(true, [], [ data[0], data[1] ]) : null);
      }

      if (!isNull(paramsData.linkedPlotId)) {
        var joinedLcTimePlot = currentObj.getPlotById(paramsData.linkedPlotId);
        if (joinedLcTimePlot.isVisible) {
          joinedLcTimePlot.setData((!isNull(data)) ? $.extend(true, [], [ data[2], data[1], [], data[3], data[4] ]) : null);
        }
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

        var unfoldedSpectrumPlot = currentObj.plots[currentObj.unfoldedSpectrumPlotIdx];
        if (unfoldedSpectrumPlot.isVisible) {
          unfoldedSpectrumPlot.setData($.extend(true, [], [ data[0], data[2] ]));
        }

      }
    });

  };

  this.appendPlot = function (plot, refreshData) {
    this.$body.append(plot.$html);
    if (isNull(refreshData) || refreshData) {
      plot.onDatasetValuesChanged(this.getFilters());
    }
  }

  log ("Output panel ready!!");
 }
