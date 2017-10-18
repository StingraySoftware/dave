function WfOutputPanel (id, classSelector, container, service, onFiltersChangedFromPlotFn, getFiltersFn) {

  var currentObj = this;

  OutputPanel.call(this, id, classSelector, container, service, onFiltersChangedFromPlotFn, getFiltersFn);

  //METHODS AND EVENTS
  this.initPlots = function(projectConfig) {

    //PLOTS HARDCODED BY THE MOMENT HERE
    if (projectConfig.schema.isLightCurveFile()) {

      //If fits is a Lightcurve
      if (projectConfig.plots.length == 0) {
        this.addLightcurveAndPdsPlots ("SRC",
                                      projectConfig.filename,
                                      projectConfig.bckFilename,
                                      projectConfig.gtiFilename,
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
      if (i >= CONFIG.INITIAL_VISIBLE_PLOTS) {
        this.plots[i].hide();
      }
    };
    this.forceResize();
    this.enableDragDrop(false);

    setTimeout( function () {
      //Forces check if all plots visible are ready.
      //If all plots are hidden no PlotReady event is rised from plots
      currentObj.onPlotReady();
    }, 2500);

  };

  this.onDatasetChanged = function ( projectConfig ) {

    // Clears output panel
    this.$body.html("");

    // Adds plots
    this.initPlots(projectConfig);

    this.onDatasetValuesChanged();
  }

  this.updatePlotsFiles = function (projectConfig) {

    var filters = this.getFilters();

    if (projectConfig.schema.isEventsFile()) {

      //Refresh all plot depending on SRC key
      for (i in this.plots) {
        var plot = this.plots[i];
        if (plot.plotConfig.selectorKey == "SRC") {
          plot.plotConfig.filename = projectConfig.filename;
          plot.plotConfig.bck_filename = projectConfig.bckFilename;
          plot.plotConfig.gti_filename = projectConfig.gtiFilename;
          plot.onDatasetValuesChanged(filters);
        }
      };

    } else if (projectConfig.schema.isLightCurveFile()) {

      //Update plots filepaths of plots depending on SRC key,
      //Only update bck file paths because if SRC were changed all the
      //tab is recreated from zero.
      var plotIds = projectConfig.getPlotsIdsByKey("SRC");

      for (id in plotIds) {
        var plot = this.getPlotById(plotIds[id]);
        if (!isNull(plot)){
          if (!isNull(plot.plotConfig.lc0_bck_filename)) {
            plot.plotConfig.lc0_bck_filename = projectConfig.bckFilename;
            plot.onDatasetValuesChanged(filters);

          } else if (!isNull(plot.plotConfig.bck_filename)) {
            plot.plotConfig.bck_filename = projectConfig.bckFilename;
            plot.onDatasetValuesChanged(filters);

          }
        }
      }
    }
  }

  this.addInfoPanel = function (filename, schema ) {
    var table = schema.getTable();
    if (!isNull(table) && !isNull(table["HEADER"])) {
      var infoPanel = new InfoPanel(this.generatePlotId("infoPanel"),
                                    filename,
                                    table["HEADER"],
                                    table["HEADER_COMMENTS"],
                                    getTabForSelector(this.id).$html.find(".HdrFileInfo").find(".sectionContainer"));
      this.$body.append(infoPanel.$html);
    } else {
      logWarn("addInfoPanel: Schema no valid tables or headers");
    }
  }


  // ------------------- SHARED PLOTS METHODS BETWEEN LC AND EVENT FITS -------------------

  this.getLightCurvePlot = function ( filename, bck_filename, gti_filename, selectorKey, tableName,
                                      labels, title, mandatoryFilters, cssClass, switchable, selectable ) {

    log("getLightCurvePlot: filename: " + filename );
    return new LcPlot(
                      this.generatePlotId("ligthcurve_" + filename),
                      {
                        selectorKey: selectorKey,
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: labels,
                                  title: title,
                                  selectable: selectable
                                },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:"PHA" } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_lightcurve,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".LcPlot").find(".sectionContainer"),
                      "LcPlot " + cssClass,
                      switchable
                    );
  }

  this.getPDSPlot = function ( projectConfig, filename, bck_filename, gti_filename, selectorKey, tableName,
                                columnName, cssClass, title, mandatoryFilters ) {

    log("getPDSPlot: filename: " + filename );
    return new PDSPlot(
                      this.generatePlotId("pds_" + filename),
                      {
                        selectorKey: selectorKey,
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: ["Frequency (Hz)", "Power"],
                                  title: title,
                                  showFitBtn: true },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_power_density_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".PDSPlot").find(".sectionContainer"),
                      "PDSPlot " + cssClass,
                      false,
                      projectConfig
                    );
  }

  this.getDynamicalSpectrumPlot = function ( projectConfig, filename, bck_filename, gti_filename,
                                              selectorKey, tableName, columnName, cssClass, title,
                                              mandatoryFilters ) {

    log("getDynamicalSpectrumPlot: filename: " + filename );
    return new DynSpPlot(
                      this.generatePlotId("dynX_" + filename),
                      {
                        selectorKey: selectorKey,
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "surface",
                                  labels: ["Frequency (Hz)", "Time (s)", "Power"],
                                  title: title,
                                  showPdsType: false
                                },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_dynamical_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".PDSPlot").find(".sectionContainer"),
                      "PDSPlot " + cssClass,
                      false,
                      projectConfig
                    );
  }


  // ------------------- LC FITS PLOTS METHODS -------------------

  this.getJoinedLightCurvesPlot = function ( lc0_filename, lc1_filename, lc0_bck_filename, lc1_bck_filename,
                                              labels, title, cssClass, switchable ) {

    log("getJoinedLightCurvesPlot: lc0_filename: " + lc0_filename + ", lc0_filename: " + lc1_filename);
    return new Plot(
                      this.generatePlotId("ligthcurve_" + lc0_filename + "_" + lc1_filename),
                      {
                        lc0_filename: lc0_filename,
                        lc1_filename: lc1_filename,
                        lc0_bck_filename: lc0_bck_filename,
                        lc1_bck_filename: lc1_bck_filename,
                        styles: { type: "scatter_with_errors", labels: labels, title: title },
                        axis: [ { table: "RATE", column:CONFIG.TIME_COLUMN },
                                { table: "RATE", column:"PHA" } ]
                      },
                      this.service.request_joined_lightcurves,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".LcPlot").find(".sectionContainer"),
                      "LcPlot " + cssClass,
                      switchable
                    );
  }

  this.tryAddDividedLightCurve = function (key0, key1, newKeySufix, projectConfig) {
    var data = {};
    data.lc0_filename = projectConfig.getFile(key0);
    data.lc1_filename = projectConfig.getFile(key1);
    data.lc0_bck_filename = projectConfig.getFile(key0 + "_BCK");
    data.lc1_bck_filename = projectConfig.getFile(key1 + "_BCK");

    var newKey = "LC_" + newKeySufix;

    if ((data.lc0_filename != "") && (data.lc1_filename != "") && (projectConfig.getFile(newKey) == "")){

      //Prepares newKey from divided lcs dataset and adds the plot to output panel
      currentObj.service.request_divided_lightcurve_ds(data, function (result) {
        var cache_key = JSON.parse(result);
        log("request_divided_lightcurve_ds Result: " + newKey + " --> " + cache_key);
        if (!isNull(cache_key) && cache_key != "") {

          projectConfig.setFile(newKey, cache_key);
          currentObj.addLightcurveAndPdsPlots (newKeySufix, cache_key, "", "", "RATE", "PHA", projectConfig, "", true);

          //After getting A/B or C/D we can calculate the Hardness and Softnes Intensity lcs
          if ((newKeySufix == "B/A") || (newKeySufix == "D/C")) {

            joined_lc_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("SRC"),
                                                                      cache_key,
                                                                      projectConfig.getFile("BCK"),
                                                                      "",
                                                                      ["Total Count Rate (c/s)", newKeySufix + " Color Ratio"],
                                                                      ((newKeySufix == "B/A") ? "Softness Intensity Diagram (SID)" : "Hardness Intensity Diagram (HID)"),
                                                                      "", true);
            projectConfig.plots.push(joined_lc_plot);
            projectConfig.addPlotId(joined_lc_plot.id, ((newKeySufix == "B/A") ? "LCB" : "LCD"));
            projectConfig.addPlotId(joined_lc_plot.id, ((newKeySufix == "B/A") ? "LCA" : "LCC"));
            projectConfig.addPlotId(joined_lc_plot.id, "SRC");

            currentObj.appendPlot(joined_lc_plot);

            //After getting A/B and C/D we can calculate the color to color plot
            if ((projectConfig.getFile("LC_B/A") != "")
                  && (projectConfig.getFile("LC_D/C") != "")){

                var abcd_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("LC_B/A"),
                                                                      projectConfig.getFile("LC_D/C"),
                                                                      "", "",
                                                                      ["B/A Color Ratio(c/s)", "D/C Color Ratio"],
                                                                      "Color-Color Diagram (CCD)", "", true);
                projectConfig.plots.push(abcd_plot);
                projectConfig.addPlotId(abcd_plot.id, "LCA");
                projectConfig.addPlotId(abcd_plot.id, "LCB");
                projectConfig.addPlotId(abcd_plot.id, "LCC");
                projectConfig.addPlotId(abcd_plot.id, "LCD");
                currentObj.appendPlot(abcd_plot);
            }
          }
        } else {
          showError("Can't get divided lightcurves data");
          log("request_divided_lightcurve_ds WRONG CACHE KEY!!");
        }
      });

      return true;
    }

    return false;
  }

  this.addLightcurveAndPdsPlots = function (titlePrefix, filename, bck_filename, gti_filename, tableName,
                                            columnName, projectConfig, cssClass, refreshData){
    var mustRefreshData = isNull(refreshData) || refreshData;

    var isJoinedLc = ((titlePrefix == "B/A") || (titlePrefix == "D/C"));
    var yLabel = isJoinedLc ? "Color Ratio" : "Count Rate(c/s)";

    var title = titlePrefix + " LC";
    if (titlePrefix == "SRC") {
      title = "Total Light Curve";
    } else if (titlePrefix.startsWith("LC")) {
      title = "Light Curve Range=" + titlePrefix.replace("LC", "");
    } else if (titlePrefix == "B/A") {
      title = "Softness Light Curve (B/A)";
    } else if (titlePrefix == "D/C") {
      title = "Hardness Light Curve (D/C)";
    }

    var lc_plot = currentObj.getLightCurvePlot ( filename, bck_filename, gti_filename,
                                                titlePrefix, tableName,
                                                ["TIME (" + projectConfig.timeUnit  + ")", yLabel],
                                                title,
                                                [], cssClass, false, !isJoinedLc);
    projectConfig.plots.push(lc_plot);
    if (titlePrefix == "B/A"){
      projectConfig.addPlotId(lc_plot.id, "LCA");
      projectConfig.addPlotId(lc_plot.id, "LCB");
    } else if (titlePrefix == "D/C"){
      projectConfig.addPlotId(lc_plot.id, "LCC");
      projectConfig.addPlotId(lc_plot.id, "LCD");
    } else {
      projectConfig.addPlotId(lc_plot.id, titlePrefix);
    }
    currentObj.appendPlot(lc_plot, mustRefreshData);

    var pds_plot = null;
    if ((titlePrefix != "B/A") && (titlePrefix != "D/C")) {

      var title = titlePrefix + " PDS";
      if (titlePrefix == "SRC") {
        title = "Total Power Density Spectrum";
      } else if (titlePrefix.startsWith("LC")) {
        title = "Power Density Spectrum Range " + titlePrefix.replace("LC", "");
      }

      pds_plot = this.getPDSPlot ( projectConfig, filename, bck_filename, gti_filename,
                                   titlePrefix, tableName, columnName, cssClass, title );
      projectConfig.plots.push(pds_plot);
      projectConfig.addPlotId(pds_plot.id, titlePrefix);
      currentObj.appendPlot(pds_plot, mustRefreshData);
    }

    if (titlePrefix == "SRC") {
      var dynamical_plot = this.getDynamicalSpectrumPlot ( projectConfig,
                                                          filename,
                                                          bck_filename,
                                                          gti_filename,
                                                          titlePrefix, tableName, columnName,
                                                          "fullScreen", "Total Dynamical Power Spectrum" );
      projectConfig.plots.push(dynamical_plot);
      projectConfig.addPlotId(dynamical_plot.id, "SRC");
      currentObj.appendPlot(dynamical_plot, mustRefreshData);

      return [lc_plot, pds_plot, dynamical_plot];
    } else {

      return [lc_plot, pds_plot];
    }
  }


  // -------------------  EVENT FITS PLOTS METHODS -------------------

  //RETURN THE PLOTS ARRAY FOR AN EVENTS FITS
  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, timeUnit, projectConfig ) {

    log("getFitsTablePlots: filename: " + filename );

    var lcPlot = this.getLightCurvePlot ( filename,
                                          bck_filename,
                                          gti_filename,
                                          "SRC",
                                          "EVENTS",
                                          ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"],
                                          "Total Light Curve",
                                          [], "fullWidth", false, true );

    var aLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit + ")", "A Count Rate(c/s)"],
                                            "Light Curve Range A",
                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumnInPlot: true } ],
                                            "", false, true );

    var bLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit + ")", "B Count Rate(c/s)"],
                                            "Light Curve Range B",
                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumnInPlot: true } ],
                                            "", false, true );

    var cLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit + ")", "C Count Rate(c/s)"],
                                            "Light Curve Range C",
                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumnInPlot: true } ],
                                            "", false, true );

    var dLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit + ")", "D Count Rate(c/s)"],
                                            "Light Curve Range D",
                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumnInPlot: true } ],
                                            "", false, true );

    var baLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit  + ")", "B/A Color Ratio"],
                                            "Softness Light Curve (B/A)",
                                            [], "fullWidth", false, false );
    baLcPlot.getDataFromServerFn = null; //Disable calls to server

    var dcLcPlot = this.getLightCurvePlot ( filename,
                                            bck_filename,
                                            gti_filename,
                                            "SRC",
                                            "EVENTS",
                                            ["TIME (" + timeUnit  + ")", "D/C Color Ratio"],
                                            "Hardness Light Curve (D/C)",
                                            [], "fullWidth", false, false );
    dcLcPlot.getDataFromServerFn = null; //Disable calls to server

    return [
              lcPlot,

              aLcPlot,

              bLcPlot,

              cLcPlot,

              dLcPlot,

              baLcPlot,

              dcLcPlot,

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "SRC",
                                                        "EVENTS",
                                                        ["D/C Color Ratio(c/s)", "B/A Color Ratio(c/s)"], "Color-Color Diagram (CCD)",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "fullWidth", true ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "SRC",
                                                        "EVENTS",
                                                        ["Total Count Rate (c/s)", "B/A Color Ratio(c/s)"], "Softness Intensity Diagram (SID)",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_A" } ],
                                                        "", true, baLcPlot ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "SRC",
                                                        "EVENTS",
                                                        ["Total Count Rate (c/s)", "D/C Color Ratio(c/s)"], "Hardness Intensity Diagram (HID)",
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_C" } ],
                                                        "", true, dcLcPlot ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "SRC", "EVENTS", "PHA", "fullWidth", "Total Power Density Spectrum" ),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "SRC", "EVENTS", "PHA", "", "Power Density Spectrum Range A",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumnInPlot: true } ]),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "SRC", "EVENTS", "PHA", "", "Power Density Spectrum Range B",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumnInPlot: true } ]),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "SRC", "EVENTS", "PHA", "", "Power Density Spectrum Range C",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumnInPlot: true } ]),

              this.getPDSPlot ( projectConfig,
                                  filename,
                                  bck_filename,
                                  gti_filename,
                                  "SRC", "EVENTS", "PHA", "", "Power Density Spectrum Range D",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumnInPlot: true } ]),

              this.getDynamicalSpectrumPlot ( projectConfig,
                                              filename,
                                              bck_filename,
                                              gti_filename,
                                              "SRC", "EVENTS", "PHA", "fullScreen", "Total Dynamical Power Spectrum" )
          ];
  }

  this.getJoinedLightCurvesFromColorsPlot = function ( filename, bck_filename, gti_filename, selectorKey,
                                                        tableName, labels, title, mandatoryFilters, cssClass,
                                                        switchable, linkedPlot ) {

    log("getJoinedLightCurvesFromColorsPlot: filename: " + filename );
    var id = this.generatePlotId("joinedLcByColors_" + filename);
    if (!isNull(linkedPlot)) {
      linkedPlot.parentPlotId = id;
    }
    return new Plot(
                      id,
                      {
                        id: id,
                        selectorKey: selectorKey,
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "scatter_with_errors", labels: labels, title: title },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:"PHA" } ],
                        mandatoryFilters: mandatoryFilters,
                        linkedPlotId: (isNull(linkedPlot)) ? null : linkedPlot.id
                      },
                      (isNull(linkedPlot)) ? this.service.request_divided_lightcurves_from_colors : this.getDividedLightCurvesFromColorsDataFromServer,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".LcPlot").find(".sectionContainer"),
                      "LcPlot " + cssClass,
                      switchable
                    );
  }

  this.addRmfPlots = function (projectConfig){

    var covarianceSpectrumPlot = new CovariancePlot(
                                      this.generatePlotId("covarianceSpectrum_" + projectConfig.filename),
                                      {
                                        selectorKey: "SRC",
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
                                      getTabForSelector(this.id).$html.find(".TimingPlot").find(".sectionContainer"),
                                      "TimingPlot fullWidth",
                                      false,
                                      projectConfig
                                    );
    this.plots.push(covarianceSpectrumPlot);
    projectConfig.addPlotId(covarianceSpectrumPlot.id, "RMF");
    if (this.waitingPlotType != "covariance") { covarianceSpectrumPlot.hide(); }
    this.appendPlot(covarianceSpectrumPlot, true);

    var rmsPlot = this.getRMSPlot ( projectConfig,
                        projectConfig.filename,
                        projectConfig.bckFilename,
                        projectConfig.gtiFilename,
                        "EVENTS", "PHA", "fullWidth", "RMS vs Energy" )
    this.plots.push(rmsPlot);
    projectConfig.addPlotId(rmsPlot.id, "RMF");
    if (this.waitingPlotType != "rms") { rmsPlot.hide(); }
    this.appendPlot(rmsPlot, true);

    var phaseLagPlot = this.getPhaseLagPlot ( projectConfig,
                        projectConfig.filename,
                        projectConfig.bckFilename,
                        projectConfig.gtiFilename,
                        "EVENTS", "PHA", "fullWidth", "Phase lag vs Energy" )
    this.plots.push(phaseLagPlot);
    projectConfig.addPlotId(phaseLagPlot.id, "RMF");
    if (this.waitingPlotType != "phaseLag") { phaseLagPlot.hide(); }
    this.appendPlot(phaseLagPlot, true);

    this.waitingPlotType = null;
  }

  this.getDividedLightCurvesFromColorsDataFromServer = function (paramsData, fn) {

    log("OutputPanel getDividedLightCurvesFromColorsDataFromServer...");

    currentObj.service.request_divided_lightcurves_from_colors(paramsData, function( jsdata ) {
      data = JSON.parse(jsdata);


      var joinedLcPlot = currentObj.getPlotById(paramsData.id);
      joinedLcPlot.setData((!isNull(data) && (data.length > 2)) ? $.extend(true, [], [ data[0], data[1] ]) : null);

      if (!isNull(paramsData.linkedPlotId)) {
        var joinedLcTimePlot = currentObj.getPlotById(paramsData.linkedPlotId);
        if (!isNull(joinedLcTimePlot)){
          joinedLcTimePlot.setData((!isNull(data) && (data.length > 4)) ? $.extend(true, [], [ data[2],
                                                                        { values: data[1].values },
                                                                        { values: data[1].error_values },
                                                                        data[3],
                                                                        data[4] ]) : null);
        }
      }
    });

  };

  this.getPhaseLagPlot = function ( projectConfig, filename, bck_filename, gti_filename, tableName,
                                    columnName, cssClass, title, mandatoryFilters ) {

    log("getPhaseLagPlot: filename: " + filename );
    return new PhaseLagPlot(
                      this.generatePlotId("phaseLag_" + filename),
                      {
                        selectorKey: "SRC",
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: ["Energy(keV)", "Phase lag"],
                                  title: title },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_phase_lag_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".TimingPlot").find(".sectionContainer"),
                      "TimingPlot " + cssClass,
                      false,
                      projectConfig
                    );
  }

  this.getRMSPlot = function ( projectConfig, filename, bck_filename, gti_filename, tableName, columnName,
                                cssClass, title, mandatoryFilters ) {

    log("getRMSPlot: filename: " + filename );
    return new RmsPlot(
                      this.generatePlotId("rms_" + filename),
                      {
                        selectorKey: "SRC",
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: ["Energy(keV)", "RMS"],
                                  title: title },
                        axis: [ { table: tableName, column:CONFIG.TIME_COLUMN },
                                { table: tableName, column:columnName } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_rms_spectrum,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".TimingPlot").find(".sectionContainer"),
                      "TimingPlot " + cssClass,
                      false,
                      projectConfig
                    );
  }

  /*this.getEventsPlot = function ( projectConfig ){
    var eventPlotId = this.generatePlotId("events_" + projectConfig.filename);
    return new Plot(
                      eventPlotId,
                      {
                        id: eventPlotId,
                        selectorKey: "SRC",
                        filename: projectConfig.filename,
                        bck_filename: "",
                        gti_filename: "",
                        styles: { type: "2d", labels: [CONFIG.TIME_COLUMN, "PI"], title: "EVENTS" },
                        axis: [ { table: "EVENTS", column:CONFIG.TIME_COLUMN },
                                { table: "EVENTS", column:"PI" } ]
                      },
                      this.service.request_plot_data,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      getTabForSelector(this.id).$html.find(".LcPlot").find(".sectionContainer"),
                      "LcPlot fullWidth",
                      false
                    );
  }*/

  log ("Workflow Output panel ready!!");
  return this;
 }
