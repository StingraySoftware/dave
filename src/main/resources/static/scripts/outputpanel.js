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
        var lc_SRC_plot = this.getLightCurvePlot (projectConfig.filename,
                                                  "", "", "RATE",
                                                  projectConfig.timeUnit,
                                                  "fullWidth", false);
        projectConfig.plots.push(lc_SRC_plot);
      }

      this.plots = projectConfig.plots;

    } else {

      //If fits is an Events fits
      this.plots = this.getFitsTablePlots(projectConfig.filename,
                                          projectConfig.bckFilename,
                                          projectConfig.gtiFilename,
                                          projectConfig.timeUnit);
    }

    //ADDS PLOTS TO PANEL
    for (i in this.plots) { this.$body.append(this.plots[i].$html); };
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
    var schema = projectConfig.schema;

    if (!isNull(schema["EVENTS"]) && !isNull(schema["EVENTS"]["HEADER"])) {
      var theInfoPanel = new infoPanel("infoPanel", "EVENTS HEADER:", schema["EVENTS"]["HEADER"], schema["EVENTS"]["HEADER_COMMENTS"], this.$toolBar);
      this.$body.append(theInfoPanel.$html);
    } else if (!isNull(schema["RATE"]) && !isNull(schema["RATE"]["HEADER"])) {
      var theInfoPanel = new infoPanel("infoPanel", "LIGHTCURVE HEADER:", schema["RATE"]["HEADER"], schema["RATE"]["HEADER_COMMENTS"], this.$toolBar);
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
    var allPlotsReady = true;
    for (i in currentObj.plots) { allPlotsReady = allPlotsReady && currentObj.plots[i].isReady; };
    if (allPlotsReady) { waitingDialog.hide(); }
  }

  this.containsId = function (id) {

    if (this.id == id) {
        return true;
    }

    for (i in this.plots) {
      if (this.plots[i].id == id) {
          return true;
      }
    }

    return false;
  }

  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, timeUnit ) {

    log("getFitsTablePlots: filename: " + filename );

    return [
                this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        timeUnit,
                                        "fullWidth",
                                        false ),

                new Plot(
                    this.id + "_colors_ligthcurve_" + filename,
                    {
                      filename: filename,
                      bck_filename: bck_filename,
                      gti_filename: gti_filename,
                      styles: { type: "colors_ligthcurve", labels: ["TIME (" + timeUnit  + ")", "SCR", "HCR"] },
                      axis: [ { table: "EVENTS", column:"TIME" },
                              { table: "EVENTS", column:"SCR_HCR" } ]
                    },
                    this.service.request_colors_lightcurve,
                    this.onFiltersChangedFromPlot,
                    this.onPlotReady,
                    this.$toolBar,
                    "fullWidth"
                  ),

                  this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                            bck_filename,
                                                            gti_filename,
                                                            "EVENTS",
                                                            ["SRC Count Rate", "A/B Count Rate(c/s)"],
                                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_A" },
                                                              { source: "ColorSelector", table:"EVENTS", column:"Color_B" } ],
                                                            "", false ),

                  this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                            bck_filename,
                                                            gti_filename,
                                                            "EVENTS",
                                                            ["SRC Count Rate", "C/D Count Rate(c/s)"],
                                                            [ { source: "ColorSelector", table:"EVENTS", column:"Color_C" },
                                                              { source: "ColorSelector", table:"EVENTS", column:"Color_D" } ],
                                                            "", false )

              ];
  }

  this.getLightCurvePlot = function ( filename, bck_filename, gti_filename, columnName, timeUnit, cssClass, switchable ) {

    log("getLightCurvePlot: filename: " + filename );
    return new Plot(
                      this.id + "_ligthcurve_" + filename,
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve", labels: ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"] },
                        axis: [ { table: columnName, column:"TIME" },
                                { table: columnName, column:"PI" } ]
                      },
                      this.service.request_lightcurve,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.getJoinedLightCurvesPlot = function ( lc0_filename, lc1_filename, labels, sources, cssClass, switchable ) {

    log("getJoinedLightCurvesPlot: lc0_filename: " + lc0_filename + ", lc0_filename: " + lc1_filename);
    return new Plot(
                      this.id + "_ligthcurve_" + lc0_filename + "_" + lc1_filename,
                      {
                        lc0_filename: lc0_filename,
                        lc1_filename: lc1_filename,
                        styles: { type: "scatter", labels: labels },
                        axis: [ { table: "RATE", column:"TIME" },
                                { table: "RATE", column:"PI" } ]
                      },
                      this.service.request_joined_lightcurves,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.getJoinedLightCurvesFromColorsPlot = function ( filename, bck_filename, gti_filename, columnName, labels, mandatoryFilters, cssClass, switchable ) {

    log("getJoinedLightCurvesFromColorsPlot: filename: " + filename );
    return new Plot(
                      this.id + "_joinedLcByColors_" + filename + "_" + (new Date()).getTime(),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "scatter", labels: labels },
                        axis: [ { table: columnName, column:"TIME" },
                                { table: columnName, column:"PI" } ],
                        mandatoryFilters: mandatoryFilters,
                      },
                      this.service.request_joined_lightcurves_from_colors,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      cssClass,
                      switchable
                    );
  }

  this.tryAddDividedLightCurve = function (key0, key1, newKeySufix, projectConfig) {
    var data = {};
    data.lc0_filename = projectConfig.getFile(key0);
    data.lc1_filename = projectConfig.getFile(key1);

    var newKey = "LC_" + newKeySufix;

    if ((data.lc0_filename != "") && (data.lc1_filename != "") && (projectConfig.getFile(newKey) == "")){
      //Prepares newKey dataset and adds the plot to output panel
      currentObj.service.request_divided_lightcurve_ds(data, function (result) {
        var cache_key = JSON.parse(result);
        log("request_divided_lightcurve_ds Result: " + newKey + " --> " + cache_key);
        if (cache_key != "") {

          projectConfig.setFile(newKey, cache_key);
          lc_plot = currentObj.getLightCurvePlot ( cache_key, "", "",
                                                  "RATE",
                                                  projectConfig.timeUnit,
                                                  "", false);
          lc_plot.plotConfig.styles.labels[1] = newKeySufix + " Count Rate(c/s)";
          projectConfig.plots.push(lc_plot);
          currentObj.appendPlot(lc_plot);



          //After getting A/B or C/D we can calculate the Hardness and Softnes Intensity lcs

          lc_src_filename = projectConfig.getFile("SRC");

          if (newKeySufix == "A/B") {

            lc_softness_plot = currentObj.getJoinedLightCurvesPlot ( lc_src_filename,
                                                                      cache_key,
                                                                      ["SRC Count Rate(c/s)", newKeySufix + " Count Rate(c/s)"],
                                                                      "", false);
            projectConfig.plots.push(lc_softness_plot);
            currentObj.appendPlot(lc_softness_plot);

          } else if (newKeySufix == "C/D") {

            lc_hardness_plot = currentObj.getJoinedLightCurvesPlot ( lc_src_filename,
                                                                      cache_key,
                                                                      ["SRC Count Rate(c/s)", newKeySufix + " Count Rate(c/s)"],
                                                                      "", true);
            projectConfig.plots.push(lc_hardness_plot);
            currentObj.appendPlot(lc_hardness_plot);

          }

        } else {
          log("request_divided_lightcurve_ds WRONG CACHE KEY!!");
        }
      });

      return true;
    }

    return false;
  }

  this.appendPlot = function (plot) {
    this.$body.append(plot.$html);
    plot.onDatasetValuesChanged(this.getFilters());
  }

  log ("Output panel ready!!");
 }
