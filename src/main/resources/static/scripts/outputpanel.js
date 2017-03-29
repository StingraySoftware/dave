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
  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, timeUnit ) {

    log("getFitsTablePlots: filename: " + filename );

    return [
              this.getPlot (this.id + "_plot_" + filename,
                            filename, bck_filename, gti_filename,
                            { type: "2d",
                              labels: ["TIME (" + timeUnit  + ")", "PI"] },
                            [ { table: "EVENTS", column:"TIME" },
                              { table: "EVENTS", column:"PI" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"],
                                        [], "fullWidth", false ),

              this.getPDSPlot ( filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PI", "fullWidth" ),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "A Count Rate(c/s)"],
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumn: "PI" } ],
                                        "", false ),

              this.getPDSPlot ( filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PI", "", "Color A",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_A", replaceColumn: "PI" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "B Count Rate(c/s)"],
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumn: "PI" } ],
                                        "", false ),

              this.getPDSPlot ( filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PI", "", "Color B",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_B", replaceColumn: "PI" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "C Count Rate(c/s)"],
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumn: "PI" } ],
                                        "", false ),

              this.getPDSPlot ( filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PI", "", "Color C",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_C", replaceColumn: "PI" } ]),

              this.getLightCurvePlot ( filename,
                                        bck_filename,
                                        gti_filename,
                                        "EVENTS",
                                        ["TIME (" + timeUnit  + ")", "D Count Rate(c/s)"],
                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumn: "PI" } ],
                                        "", false ),

              this.getPDSPlot ( filename,
                                  bck_filename,
                                  gti_filename,
                                  "EVENTS", "PI", "", "Color D",
                                  [ { source: "ColorSelector", table:"EVENTS", column:"Color_D", replaceColumn: "PI" } ]),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["SRC Count Rate", "A/B Count Rate(c/s)"],
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_A" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_B" } ],
                                                        "", true ),

              this.getJoinedLightCurvesFromColorsPlot ( filename,
                                                        bck_filename,
                                                        gti_filename,
                                                        "EVENTS",
                                                        ["SRC Count Rate", "C/D Count Rate(c/s)"],
                                                        [ { source: "ColorSelector", table:"EVENTS", column:"Color_C" },
                                                          { source: "ColorSelector", table:"EVENTS", column:"Color_D" } ],
                                                        "", true ),

              this.getPlot (this.id + "_colors_ligthcurve_" + filename,
                            filename, bck_filename, gti_filename,
                            { type: "colors_ligthcurve",
                              labels: ["TIME (" + timeUnit  + ")", "SCR", "HCR"],
                              title: "COLOR_COLOR" },
                            [ { table: "EVENTS", column:"TIME" },
                                    { table: "EVENTS", column:"SCR_HCR" } ],
                            this.service.request_color_color_lightcurve)
          ];
  }

  this.getPlot = function (id, filename, bck_filename, gti_filename, styles, axis, fn) {
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
              "fullWidth",
              false
            );
  }

  this.getLightCurvePlot = function ( filename, bck_filename, gti_filename, tableName, labels, mandatoryFilters, cssClass, switchable ) {

    log("getLightCurvePlot: filename: " + filename );
    return new Plot(
                      this.id + "_ligthcurve_" + filename + "_" + (new Date()).getTime(),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "ligthcurve",
                                  labels: labels,
                                  selectable: true
                                },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:"PI" } ],
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

  this.getJoinedLightCurvesFromColorsPlot = function ( filename, bck_filename, gti_filename, tableName, labels, mandatoryFilters, cssClass, switchable ) {

    log("getJoinedLightCurvesFromColorsPlot: filename: " + filename );
    return new Plot(
                      this.id + "_joinedLcByColors_" + filename + "_" + (new Date()).getTime(),
                      {
                        filename: filename,
                        bck_filename: bck_filename,
                        gti_filename: gti_filename,
                        styles: { type: "scatter", labels: labels },
                        axis: [ { table: tableName, column:"TIME" },
                                { table: tableName, column:"PI" } ],
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

  this.getPDSPlot = function ( filename, bck_filename, gti_filename, tableName, columnName, cssClass, title, mandatoryFilters ) {

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
                      false
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
          currentObj.addLightcurveAndPdsPlots (newKeySufix, cache_key, "", "", "RATE", "PI", projectConfig);

          //After getting A/B or C/D we can calculate the Hardness and Softnes Intensity lcs

          if ((newKeySufix == "A/B") || (newKeySufix == "C/D")) {

            joined_lc_plot = currentObj.getJoinedLightCurvesPlot ( projectConfig.getFile("SRC"),
                                                                      cache_key,
                                                                      ["SRC Count Rate(c/s)", newKeySufix + " Count Rate(c/s)"],
                                                                      "", true);
            projectConfig.plots.push(joined_lc_plot);
            currentObj.appendPlot(joined_lc_plot);
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

    var lc_plot = currentObj.getLightCurvePlot ( filename, bck_filename, gti_filename,
                                                tableName,
                                                ["TIME (" + projectConfig.timeUnit  + ")", "Count Rate(c/s)"],
                                                [], cssClass, false);
    lc_plot.plotConfig.styles.title = titlePrefix + " LC";
    projectConfig.plots.push(lc_plot);
    currentObj.appendPlot(lc_plot, mustRefreshData);

    var pds_plot = this.getPDSPlot ( filename, bck_filename, gti_filename,
                                    tableName, columnName, cssClass );
    pds_plot.plotConfig.styles.title = titlePrefix + " PDS";
    projectConfig.plots.push(pds_plot);
    currentObj.appendPlot(pds_plot, mustRefreshData);

    return [lc_plot, pds_plot];
  }

  this.appendPlot = function (plot, refreshData) {
    this.$body.append(plot.$html);
    if (isNull(refreshData) || refreshData) {
      plot.onDatasetValuesChanged(this.getFilters());
    }
  }

  this.prependPlot = function (plot, refreshData) {
    this.$body.prepend(plot.$html);
    if (isNull(refreshData) || refreshData) {
      plot.onDatasetValuesChanged(this.getFilters());
    }
  }

  log ("Output panel ready!!");
 }
