
//Adds new Phaseogram Tab Panel
function addPHTabPanel(navBarList, panelContainer, plotConfig, projectConfig, plotStyle, id, navItemClass){
  return new PHTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService, navBarList, panelContainer, plotConfig, projectConfig, plotStyle);
}

//Subscribes the load workspace PHTabPanel function
tabPanelsLoadFns["PHTabPanel"] = function (tabConfig) {
  //Creates new Periodogram Tab Panel
  return addPHTabPanel($("#navbar").find("ul").first(),
                      $(".daveContainer"),
                      tabConfig.plotConfig,
                      null,
                      tabConfig.plotConfig.plotStyle,
                      tabConfig.id,
                      tabConfig.navItemClass);
}

//Phaseogram Tab Panel
function PHTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig, plotStyle) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //PHTabPanel METHODS:
  this.getPageName = function () {
    return "PhaseogramPage";
  }

  this.getConfig = function () {
    return { type: "PHTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             plotConfig: this.plotConfig,
             projectConfig: this.projectConfig.getConfig(),
             outputPanelConfig: this.outputPanel.getConfig(),
             plotDefaultConfig: this.plotDefaultConfig
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    if (!isNull(tabConfig.plotDefaultConfig)){
      this.plotDefaultConfig = $.extend(true, {}, tabConfig.plotDefaultConfig);
    }
    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.updateSelectedFile(tabConfig.plotConfig, this.projectConfig);
    this.createPlots();
    this.outputPanel.setConfig(tabConfig.outputPanelConfig);

    callback();
  }

  this.createPlots = function () {

    //Adds FreqRangePlot Plot to outputPanel
    this.freqRangePlot = new FreqRangePlot(
                      this.id + "_pg_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { type: "ligthcurve",
                                  title: "Power Density Spectrum",
                                  labels: ["Frequency (Hz)", "Power"],
                                  selectable: false,
                                  showFitBtn: true }
                      }),
                      this.service.request_power_density_spectrum,
                      function (filters) {
                        //onFiltersChangedFromPlot
                        if (!isNull(currentObj.freqRangeSelector)){
                          currentObj.freqRangeSelector.setValues( filters[0].from, filters[0].to );
                          currentObj.freqRangePlot.plotConfig.selected_freq_range = [ filters[0].from, filters[0].to ];
                          currentObj.freqRangePlot.redrawDiffered();
                        }
                      },
                      function () {
                        //On FreqRangePlot Plot Ready
                        if (!isNull(currentObj.freqRangePlot.data)
                            && currentObj.freqRangePlot.data[0].values.length > 0){
                              currentObj.outputPanel.onPlotReady();
                              if (isNull(currentObj.freqRangeSelector)){
                                //We already know the freq range, so create controls
                                currentObj.addControls();
                              } else {
                                //Else update freqRangeSelector
                                var freqRange = currentObj.freqRangePlot.getDefaultFreqRange();
                                currentObj.freqRangeSelector.setMinMaxValues(freqRange[0], freqRange[1]);
                              }
                        } else if (!isNull(currentObj.freqRangePlot.data)
                                   && currentObj.freqRangePlot.data[3].values.length > 0) {
                          currentObj.freqRangePlot.showWarn(currentObj.freqRangePlot.data[3].values[0]);
                        } else {
                          currentObj.freqRangePlot.showWarn("Wrong PDS data");
                        }
                      },
                      null,
                      "fullWidth",
                      false,
                      this.projectConfig,
                      !isNull(plotStyle) ? $.extend(true, {}, plotStyle) : null
                    );
    this.addPlot(this.freqRangePlot, false);

    //Adds Pulse Search Plot to outputPanel
    this.psPlot = new PulseSearchPlot(
                      this.id + "_ph_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Pulse Search Results",
                                  labels: ["Frequency (Hz)", "Statistics - d.o.f."],
                                  selectable: false }
                      }),
                      this.service.request_pulse_search,
                      this.outputPanel.onFiltersChangedFromPlot,
                      function () {
                        //On ZSearchPlot Plot Ready
                        waitingDialog.hide();
                        currentObj.outputPanel.onPlotReady();
                        if (!isNull(currentObj.freqRangeSelector)){
                          currentObj.onCandidateFrequenciesFound();
                        }
                      },
                      null,
                      "fullWidth",
                      false
                    );
    this.psPlot.hide();
    this.addPlot(this.psPlot, false);

    //Adds Profile Plot to outputPanel
    this.prPlot = new ProfilePlot(
                      this.id + "_pr_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Profile",
                                  labels: ["Phase", "Counts"],
                                  selectable: false }
                      }),
                      null,
                      this.outputPanel.onFiltersChangedFromPlot,
                      currentObj.outputPanel.onPlotReady,
                      null,
                      "fullWidth",
                      false
                    );
    this.prPlot.hide();
    this.addPlot(this.prPlot, false);

    //Adds Phaseogram Plot to outputPanel
    this.phPlot = new PhPlot(
                      this.id + "_ph_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Phaseogram",
                                  labels: ["Color", "Phase", "TIME (" + this.projectConfig.timeUnit  + ")"],
                                  selectable: false }
                      }),
                      null,
                      this.outputPanel.onFiltersChangedFromPlot,
                      currentObj.outputPanel.onPlotReady,
                      null,
                      "fullScreen",
                      false,
                      this.projectConfig
                    );
    this.phPlot.hide();
    this.addPlot(this.phPlot, false);

    //Request plot data after all plots were added
    this.freqRangePlot.onDatasetValuesChanged(this.outputPanel.getFilters());
  }

  this.onBinSizeChanged = function (dt) {
    currentObj.projectConfig.binSize = dt;
    currentObj.psPlot.plotConfig.dt = dt;
    currentObj.prPlot.plotConfig.dt = dt;
    currentObj.phPlot.plotConfig.dt = dt;
  }

  this.addControls = function(){

    this.pulseSearchSection = getSection ("Pulse Search", "pulseSearch", true, null, "HlSection");
    var $pulseSearchContainer = getSectionContainer(this.pulseSearchSection);

    //Adds frequency range selector
    var freqRange = this.freqRangePlot.getDefaultFreqRange();
    if ((freqRange[0] == freqRange[1]) && (freqRange[0] < 0)){
      logWarn("PHTabPanel.addControls: No valid frecuency range.");
      return;
    }

    this.freqRangeSelector = new sliderSelector(this.id + "_FreqRange",
                                      "Frequency Range (Hz):",
                                      { table:"EVENTS", column:"FREQ", source: "frequency" },
                                      freqRange[0], freqRange[1],
                                      this.onFreqRangeValuesChanged,
                                      null,
                                      function( event, ui ) {
                                        currentObj.freqRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
                                        currentObj.freqRangePlot.plotConfig.selected_freq_range = [ ui.values[ 0 ], ui.values[ 1 ]];
                                        setTimeout( function () {
                                          currentObj.freqRangePlot.redrawDiffered();
                                        }, 120);
                                      },
                                      null,
                                      getStepSizeFromRange(freqRange[1] - freqRange[0], 100));
    this.freqRangeSelector.setEnabled(true);
    $pulseSearchContainer.append(this.freqRangeSelector.$html);

    //Adds Pulse Search Advanced controls container
    var $pulseSearchAdv = getSection ("Pulse Search (advanced)", "pulseSearchAdv", currentObj.pulseSearchAdvEnabled, function ( enabled ) {
       currentObj.pulseSearchAdvEnabled = enabled;
    });
    var $pulseSearchAdvContainer = getSectionContainer($pulseSearchAdv);

    //Creates Pulse search mode radios on Pulse Search Advanced container
    var $psModeRadiosCont = getRadioControl(this.id,
                                            "Search Mode",
                                            "psMode",
                                            [
                                              { id:"ZNS", label:"Z-squared", value:"z_n_search"},
                                              { id:"EF", label:"Epoch folding", value:"epoch_folding"}
                                            ],
                                            this.psPlot.plotConfig.mode,
                                            function(value) {
                                              currentObj.psPlot.plotConfig.mode = value;
                                              setVisibility(currentObj.toolPanel.$html.find(".harmonics"), value=="z_n_search");
                                            });
    $pulseSearchAdvContainer.append($psModeRadiosCont);

    //Creates extra fields on Pulse Search Advanced container
    $pulseSearchAdvContainer.append($('<p>Pulse peak oversampling:</br><input id="os_' + this.id + '" class="inputOS" type="text" name="os_' + this.id + '" placeholder="' + this.psPlot.ps_opts.oversampling.default + '" value="' + this.psPlot.ps_opts.oversampling.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.oversampling.min + '-' + this.psPlot.ps_opts.oversampling.max + '</span></p>' +
                                       '<p class="harmonics">Number of harmonics:</br><input id="nh_' + this.id + '" class="inputNH" type="text" name="nh_' + this.id + '" placeholder="' + this.psPlot.ps_opts.nharm.default + '" value="' + this.psPlot.ps_opts.nharm.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.nharm.min + '-' + this.psPlot.ps_opts.nharm.max + '</span></p>' +
                                       '<p>Number of bins:</br><input id="nb_' + this.id + '" class="inputNB" type="text" name="nb_' + this.id + '" placeholder="' + this.psPlot.ps_opts.nbin.default + '" value="' + this.psPlot.ps_opts.nbin.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.nbin.min + '-' + this.psPlot.ps_opts.nbin.max + '</span></p>' +
                                       '<p>Length of the segments:</br><input id="ls_' + this.id + '" class="inputLS" type="text" name="ls_' + this.id + '" placeholder="' + this.psPlot.ps_opts.segment_size.default + '" value="' + this.psPlot.ps_opts.segment_size.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.segment_size.min + '-' + this.psPlot.ps_opts.segment_size.max + '</span></p>'));
    $pulseSearchContainer.append($pulseSearchAdv);

    //Adds Run Pulse Search button
    var searchBtn = $('<button class="btn btn-primary searchBtn"><i class="fa ffa-signal" aria-hidden="true"></i> Run Pulse Search</button>');
    searchBtn.click(function () {
      currentObj.onPulseSearchClick();
      gaTracker.sendEvent("Phaseogram", "PulseSearchClick", currentObj.id);
    });
    $pulseSearchContainer.append(searchBtn);
    this.toolPanel.$html.find(".fileSelectorsContainer").append(this.pulseSearchSection);


    //Adds phaseogram controls
    var $phaseogram = getSection ("Phaseogram", "phaseogram", true, null, "HlSection");
    $phaseogram.hide();
    var $phaseogramContainer = getSectionContainer($phaseogram);

    //Candidate frequency selector
    var selectId = 'candFreqChooser_' + this.id;
    $phaseogramContainer.append($('<label for="' + selectId + '">Found pulses:</label>'));
    this.candFreqChooser = $('<select name="' + selectId + '" id="' + selectId + '"></select>');
    $phaseogramContainer.append(this.candFreqChooser);

    //Candidate frequency slider
    this.freqSelector = new BinSelector(this.id + "_freqSelector",
                                      "Frequency Tuning:",
                                      freqRange[0], freqRange[1], this.freqRangeSelector.step, (freqRange[1] - freqRange[0])/2,
                                      this.onFreqSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.freqSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onFreqSelectorValuesChanged();
                                      });
    this.freqSelector.precision = 5;
    this.freqSelector.inputChanged = function ( event ) {
       currentObj.freqSelector.setValues( getInputFloatValue(currentObj.freqSelector.fromInput, currentObj.psPlot.candidateFreq) );
       currentObj.onFreqSelectorValuesChanged();
    };
    $phaseogramContainer.append(this.freqSelector.$html);

    var restoreBtn = $('<button class="btn btn-default restoreBtn" style="float: right; margin-top: -30px;">Restore</button>');
    restoreBtn.click(function () {
      if (!isNull(currentObj.candidateFrequency)){
        currentObj.freqSelector.setValues(currentObj.candidateFrequency);
        currentObj.phPlot.resetFrequecy(currentObj.candidateFrequency);
        currentObj.createPhaseogramSliders();
        currentObj.getPhaseogramFromServer();
      }
    });
    this.freqSelector.$html.find(".selectorContainer").prepend(restoreBtn);

    //Adds phaseogram advanced controls
    var $phaseogramAdv = getSection ("Phaseogram (advanced)", "phaseogramAdv", currentObj.phaseogramAdvEnabled, function ( enabled ) {
       currentObj.phaseogramAdvEnabled = enabled;
    });
    var $phaseogramAdvContainer = getSectionContainer($phaseogramAdv);
    $phaseogramAdvContainer.append($('<p>Number of phase bins:</br><input id="nph_' + this.id + '" class="inputNPH" type="text" name="nph_' + this.id + '" placeholder="' + this.phPlot.ph_opts.nph.default + '" value="' + this.phPlot.ph_opts.nph.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.phPlot.ph_opts.nph.min + '-' + this.phPlot.ph_opts.nph.max + '</span></p>' +
                                      '<p>Number of time bins:</br><input id="ntb_' + this.id + '" class="inputNTB" type="text" name="ntb_' + this.id + '" placeholder="' + this.phPlot.ph_opts.nt.default + '" value="' + this.phPlot.ph_opts.nt.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.phPlot.ph_opts.nt.min + '-' + this.phPlot.ph_opts.nt.max + '</span></p>'));
    $phaseogramAdvContainer.find("input").on('change', this.onPHTexboxesChanged);
    $phaseogramContainer.append($phaseogramAdv);

    this.toolPanel.$html.find(".fileSelectorsContainer").append($phaseogram);

    this.createPhaseogramSliders();
  }

  this.onPulseSearchClick = function() {
    waitingDialog.show('Running pulse search...');
    currentObj.psPlot.plotConfig.freq_range = [currentObj.freqRangeSelector.fromValue, currentObj.freqRangeSelector.toValue];
    currentObj.psPlot.plotConfig.oversampling = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputOS"), currentObj.psPlot.ps_opts.oversampling.default, currentObj.psPlot.ps_opts.oversampling.min, currentObj.psPlot.ps_opts.oversampling.max);
    currentObj.psPlot.plotConfig.nharm = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNH"), currentObj.psPlot.ps_opts.nharm.default, currentObj.psPlot.ps_opts.nharm.min, currentObj.psPlot.ps_opts.nharm.max);
    currentObj.psPlot.plotConfig.nbin = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNB"), currentObj.psPlot.ps_opts.nbin.default, currentObj.psPlot.ps_opts.nbin.min, currentObj.psPlot.ps_opts.nbin.max);
    currentObj.psPlot.plotConfig.segment_size = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputLS"), currentObj.psPlot.ps_opts.segment_size.default, currentObj.psPlot.ps_opts.segment_size.min, currentObj.psPlot.ps_opts.segment_size.max);
    currentObj.psPlot.show();
  }

  this.onFreqSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.f = currentObj.freqSelector.value;
    currentObj.createPhaseogramSliders();
    if (!isNull(currentObj.freqSelectorTimeOutId)){
      clearTimeout(currentObj.freqSelectorTimeOutId);
    }
    currentObj.freqSelectorTimeOutId = setTimeout( function () {
      currentObj.getPhaseogramFromServer();
    }, 350);
  }

  this.createPhaseogramSliders = function () {

    //Prepares containers
    var $phaseogramContainer = getSectionContainer(this.toolPanel.$html.find(".phaseogram"));
    $phaseogramContainer.find(".phSlidersContainer").remove();
    var $phSliders = getSection ("Pulse adjustment", "phSlidersContainer",
                                    currentObj.phPlot.showLines,
                                    function ( enabled ) {
                                      currentObj.phPlot.showLines = enabled;
                                      if (enabled) {
                                        currentObj.phPlot.redrawDiffered();
                                      } else {
                                        currentObj.phPlot.resetFrequecy(currentObj.candidateFrequency);
                                        currentObj.createPhaseogramSliders();
                                        currentObj.getPhaseogramFromServer();
                                      }
                                  });
    $phaseogramContainer.append($phSliders);
    var $phSlidersContainer = getSectionContainer($phSliders);

    var sliderPrecision = 3;

    //Resets plot temp values
    this.phPlot.resetTempValues();

    //Creates Pulse search mode radios on Pulse Search Advanced container
    var $adjModeRadiosCont = getRadioControl(this.id,
                                            "Mode",
                                            "adjMode",
                                            [
                                              { id:"pder", label:"Period derivatives", value:"per_der"},
                                              { id:"orbm", label:"Orbital motion", value:"orbital_motion"}
                                            ],
                                            this.phSlidersMode,
                                            function( value ) {
                                              currentObj.onPhSlidersModeChanged(value);
                                              currentObj.restorePhSliders();
                                            });
    $phSlidersContainer.append($adjModeRadiosCont);

    //Df slider
    var delta_df_start = 4 / this.projectConfig.getTimeRange();
    this.df_order_of_mag = Math.floor(Math.log10(delta_df_start));
    var delta_df = delta_df_start / Math.pow(10, this.df_order_of_mag);
    this.dfSelector = new BinSelector(this.id + "_dfSelector",
                                      "Delta freq x$10^" + this.df_order_of_mag,
                                      -delta_df, delta_df, Math.pow(10, -sliderPrecision), currentObj.phPlot.plotConfig.tmp_df,
                                      this.onDfSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.dfSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onDfSelectorValuesChanged();
                                      });
    this.dfSelector.precision = sliderPrecision;
    this.dfSelector.inputChanged = function ( event ) {
       currentObj.dfSelector.setValues( getInputFloatValue(currentObj.dfSelector.fromInput, currentObj.phPlot.plotConfig.tmp_df) );
       currentObj.onDfSelectorValuesChanged();
    };
    $phSlidersContainer.append(this.dfSelector.$html);

    //Fdot slider
    var delta_dfdot_start = 8 / Math.pow(this.projectConfig.getTimeRange(), 2);
    this.dfdot_order_of_mag = Math.floor(Math.log10(delta_dfdot_start));
    var delta_dfdot = delta_dfdot_start / Math.pow(10, this.dfdot_order_of_mag);
    this.fdotSelector = new BinSelector(this.id + "_fdotSelector",
                                      "Delta fdot x$10^" + this.dfdot_order_of_mag,
                                      -delta_dfdot, delta_dfdot, Math.pow(10, -sliderPrecision), currentObj.phPlot.plotConfig.tmp_fdot,
                                      this.onFdotSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.fdotSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onFdotSelectorValuesChanged();
                                      });
    this.fdotSelector.precision = sliderPrecision;
    this.fdotSelector.inputChanged = function ( event ) {
       currentObj.fdotSelector.setValues( getInputFloatValue(currentObj.fdotSelector.fromInput, currentObj.phPlot.plotConfig.tmp_fdot) );
       currentObj.onFdotSelectorValuesChanged();
    };
    $phSlidersContainer.append(this.fdotSelector.$html);

    //Fddot slider
    var delta_dfddot_start = 16 / Math.pow(this.projectConfig.getTimeRange(), 3);
    this.dfddot_order_of_mag = Math.floor(Math.log10(delta_dfddot_start));
    var delta_dfddot = delta_dfddot_start / Math.pow(10, this.dfddot_order_of_mag);
    this.fddotSelector = new BinSelector(this.id + "_fddotSelector",
                                      "Delta fddot x$10^" + this.dfddot_order_of_mag,
                                      -delta_dfddot, delta_dfddot, Math.pow(10, -sliderPrecision), currentObj.phPlot.plotConfig.tmp_fddot,
                                      this.onFddotSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.fddotSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onFddotSelectorValuesChanged();
                                      });
    this.fddotSelector.precision = sliderPrecision;
    this.fddotSelector.inputChanged = function ( event ) {
       currentObj.fddotSelector.setValues( getInputFloatValue(currentObj.fddotSelector.fromInput, currentObj.phPlot.plotConfig.tmp_fddot) );
       currentObj.onFddotSelectorValuesChanged();
    };
    $phSlidersContainer.append(this.fddotSelector.$html);

    //Orbital Period slider
    var delta_period = this.projectConfig.getTimeRange() * 5;
    var orbital_period = !isNull(currentObj.phPlot.plotConfig.binary_params) ?
                            currentObj.phPlot.plotConfig.binary_params[0] :
                            this.projectConfig.getTimeRange() * 0.99;
    this.orbPerSelector = new BinSelector(this.id + "_orbPerSelector",
                                      "Orb. Per. (s)",
                                      Math.max(this.projectConfig.getTimeRange() - delta_period),
                                      this.projectConfig.getTimeRange() + delta_period,
                                      this.projectConfig.getTimeRange() / 500,
                                      orbital_period,
                                      this.onOrbPerSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.orbPerSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onOrbPerSelectorValuesChanged();
                                      });
    this.orbPerSelector.precision = CONFIG.MAX_TIME_RESOLUTION_DECIMALS;
    this.orbPerSelector.inputChanged = function ( event ) {
       currentObj.orbPerSelector.setValues( getInputFloatValue(currentObj.orbPerSelector.fromInput, currentObj.phPlot.plotConfig.tmp_binary_params[0]) );
       currentObj.onOrbPerSelectorValuesChanged();
    };
    $phSlidersContainer.append(this.orbPerSelector.$html);

    //Asini slider
    var delta_asini = 5 / currentObj.phPlot.plotConfig.f;
    var min_asini = 1 / Math.pow(10, CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
    var asini = !isNull(currentObj.phPlot.plotConfig.binary_params) ? currentObj.phPlot.plotConfig.binary_params[1] : min_asini * 500;
    this.asiniSelector = new BinSelector(this.id + "_asiniSelector",
                                      "a sin i / c (l-sec)",
                                      min_asini, asini + delta_asini, (asini + delta_asini) / 500, asini,
                                      this.onAsiniSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.asiniSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onAsiniSelectorValuesChanged();
                                      });
    this.asiniSelector.precision = CONFIG.MAX_TIME_RESOLUTION_DECIMALS;
    this.asiniSelector.inputChanged = function ( event ) {
       currentObj.asiniSelector.setValues( getInputFloatValue(currentObj.asiniSelector.fromInput, currentObj.phPlot.plotConfig.tmp_binary_params[1]) );
       currentObj.onAsiniSelectorValuesChanged();
    };
    $phSlidersContainer.append(this.asiniSelector.$html);

    //Asini slider
    var delta_t0 = delta_period;
    var t0 = !isNull(currentObj.phPlot.plotConfig.binary_params) ? currentObj.phPlot.plotConfig.binary_params[2] : 0;
    this.t0Selector = new BinSelector(this.id + "_t0Selector",
                                      "T0 (MET)",
                                      t0 - delta_t0, t0 + delta_t0, (delta_t0 * 2) / 500, t0,
                                      this.onT0SelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.t0Selector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onT0SelectorValuesChanged();
                                      });
    this.t0Selector.precision = CONFIG.DEFAULT_NUMBER_DECIMALS;
    this.t0Selector.inputChanged = function ( event ) {
       currentObj.t0Selector.setValues( getInputFloatValue(currentObj.t0Selector.fromInput, currentObj.phPlot.plotConfig.tmp_binary_params[2]) );
       currentObj.onT0SelectorValuesChanged();
    };
    $phSlidersContainer.append(this.t0Selector.$html);

    //Adds the Recalculate button
    var recalculateBtn = $('<button class="btn btn-success applyPhBtn" style="float: left; margin-top: 24px; margin-bottom: 40px;">Recalculate</button>');
    recalculateBtn.click(function () {
      currentObj.phPlot.applySliders();
      currentObj.createPhaseogramSliders();
      currentObj.getPhaseogramFromServer();
      currentObj.addInfoPanel();
    });
    $phSlidersContainer.append(recalculateBtn);

    //Adds the Restore sliders button
    var restorePhBtn = $('<button class="btn btn-default restorePhBtn" style="float: right; margin-top: 24px;">Restore</button>');
    restorePhBtn.click(function () {
      currentObj.restorePhSliders();
    });
    $phSlidersContainer.append(restorePhBtn);

    //Sets selectors visibilities
    this.onPhSlidersModeChanged(this.phSlidersMode);

    //Removes infoPanel if exists
    this.outputPanel.$body.find(".infoPanel").remove();
  }

  this.onPhSlidersModeChanged = function(mode) {
    this.phSlidersMode = mode;

    setVisibility(this.dfSelector.$html, mode=="per_der");
    setVisibility(this.fdotSelector.$html, mode=="per_der");
    setVisibility(this.fddotSelector.$html, mode=="per_der");

    setVisibility(this.orbPerSelector.$html, mode=="orbital_motion");
    setVisibility(this.asiniSelector.$html, mode=="orbital_motion");
    setVisibility(this.t0Selector.$html, mode=="orbital_motion");

    if (mode=="per_der"){
      this.phPlot.resetTempValues();
    } else {
      this.phPlot.plotConfig.tmp_binary_params = [ currentObj.orbPerSelector.initValue,
                                                   currentObj.asiniSelector.initValue,
                                                   currentObj.t0Selector.initValue ];
    }
  }

  this.onDfSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_df = currentObj.dfSelector.value * Math.pow(10, currentObj.dfdot_order_of_mag);
    currentObj.phPlot.redrawDiffered();
  }

  this.onFdotSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_fdot = currentObj.fdotSelector.value * Math.pow(10, currentObj.df_order_of_mag);
    currentObj.phPlot.redrawDiffered();
  }

  this.onFddotSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_fddot = currentObj.fddotSelector.value * Math.pow(10, currentObj.dfdot_order_of_mag);
    currentObj.phPlot.redrawDiffered();
  }

  this.onOrbPerSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_binary_params[0] = currentObj.orbPerSelector.value;
    currentObj.phPlot.redrawDiffered();
  }

  this.onAsiniSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_binary_params[1] = currentObj.asiniSelector.value;
    currentObj.phPlot.redrawDiffered();
  }

  this.onT0SelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.tmp_binary_params[2] = currentObj.t0Selector.value;
    currentObj.phPlot.redrawDiffered();
  }

  this.restorePhSliders = function () {
    this.phPlot.resetFrequecy(this.candidateFrequency);
    this.createPhaseogramSliders();
    this.getPhaseogramFromServer();
  }

  this.onPHTexboxesChanged = function(event){
    if ($(event.target).hasClass("inputNPH")){
      currentObj.phPlot.plotConfig.nph = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNPH"), currentObj.phPlot.plotConfig.nph, currentObj.phPlot.ph_opts.nph.min, currentObj.phPlot.ph_opts.nph.max);
      if (currentObj.phPlot.plotConfig.nt < currentObj.phPlot.plotConfig.nph * 2) {
        currentObj.phPlot.plotConfig.nt = Math.floor(currentObj.phPlot.plotConfig.nph * 2);
        currentObj.toolPanel.$html.find(".inputNTB").val(currentObj.phPlot.plotConfig.nt);
      }
    } else {
      currentObj.phPlot.plotConfig.nt = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNTB"), currentObj.phPlot.plotConfig.nt, currentObj.phPlot.ph_opts.nt.min, currentObj.phPlot.ph_opts.nt.max);
      if (currentObj.phPlot.plotConfig.nt < currentObj.phPlot.plotConfig.nph * 2) {
        currentObj.phPlot.plotConfig.nph = Math.floor(currentObj.phPlot.plotConfig.nt / 2);
        currentObj.toolPanel.$html.find(".inputNPH").val(currentObj.phPlot.plotConfig.nph);
      }
    }
    currentObj.getPhaseogramFromServer();
  }

  this.onCandidateFrequenciesFound = function () {
    if (!isNull(currentObj.psPlot.candidateFreqs) && currentObj.psPlot.candidateFreqs.length > 0) {

      //If we have candidate frequency we can continue plotting the plofile and phaseogram
      //Fill candidate frequencies selector
      currentObj.candFreqChooser.html("");
      for (i = 0; i < currentObj.psPlot.candidateFreqs.length; i++) {
        var candFreq = currentObj.psPlot.candidateFreqs[i];
        var option = '<option value="' + i + '" ' + ((i == 0) ? 'selected="selected"' : '') + '>' +
                        i + ' - '  + candFreq.freq + ' Hz , ' + fixedPrecision(candFreq.ratio * 100, 1)  + '%' +
                      '</option>';
        currentObj.candFreqChooser.append(option);
      }
      currentObj.candFreqChooser.selectmenu({
        change: function( event, ui ) {
          currentObj.onCandFreqChooserChanged();
        }
      });

      //Shows phaseogram controls
      var freqRange = currentObj.psPlot.plotConfig.freq_range;
      currentObj.freqSelector.setMinMaxValues(freqRange[0],
                                              freqRange[1],
                                              getStepSizeFromRange(freqRange[1] - freqRange[0], 1000));
      setSectionState (currentObj.pulseSearchSection, false);
      setVisibility(currentObj.toolPanel.$html.find(".phaseogram"), true);

      //Minimize Pulse Search Plots
      if (currentObj.freqRangePlot.$html.hasClass("fullWidth")) {
        currentObj.freqRangePlot.btnFullScreen.click();
      }
      if (currentObj.psPlot.$html.hasClass("fullWidth")) {
        currentObj.psPlot.btnFullScreen.click();
      }

      //Show Phaseogram
      currentObj.prPlot.show();
      currentObj.phPlot.show();

      //Force refresh controls
      currentObj.onCandFreqChooserChanged();

    } else {
      currentObj.prPlot.hide();
      currentObj.phPlot.hide();
      setVisibility(currentObj.toolPanel.$html.find(".phaseogram"), false);
    }
  }

  this.onCandFreqChooserChanged = function () {
    var candFreqIdx = parseInt(currentObj.candFreqChooser.val());
    var candFreq = currentObj.psPlot.candidateFreqs[candFreqIdx];
    currentObj.candidateFrequency = candFreq.freq;
    currentObj.freqSelector.setValues(currentObj.candidateFrequency);
    currentObj.onFreqSelectorValuesChanged();
  }

  this.getPhaseogramFromServer = function () {

    log("PhTabPanel getPhaseogramFromServer...");

    if (!isNull(currentObj.currentRequest) && !isNull(currentObj.currentRequest.abort)) {
      currentObj.currentRequest.abort();
    }

    currentObj.outputPanel.setPlotsReadyState(false);

    currentObj.currentRequest = currentObj.service.request_phaseogram(currentObj.phPlot.plotConfig, function( jsdata ) {

      if (!isNull(jsdata.abort)){
        log("Current request aborted, PhTabPanel: " + currentObj.id);
        if (jsdata.statusText == "error"){
          //If abort cause is because python server died
          currentObj.outputPanel.setPlotsReadyState(true);
        }
        return; //Comes from request abort call.
      }

      log("PHData received!, PhTabPanel: " + currentObj.id);
      data = JSON.parse(jsdata);

      if (isNull(data)) {
        log("onPlotReceived wrong data!, PhTabPanel: " + currentObj.id);
        currentObj.outputPanel.setPlotsReadyState(true);
        return;

      } else if (!isNull(data.error)) {
        currentObj.phPlot.showWarn(data.error);
        log("onPlotDataReceived data error: " + data.error + ", PhTabPanel: " + currentObj.id);
        currentObj.outputPanel.setPlotsReadyState(true);
        return;

      } else {

        //Sends data to phPlot
        if (currentObj.phPlot.isVisible) {
          currentObj.phPlot.setData([ data[0], data[1], data[2] ]);
        }

        //Sends data to prPlot
        if (currentObj.prPlot.isVisible) {
          currentObj.prPlot.setData([ data[3], data[4], data[5] ]);
        }

        currentObj.outputPanel.setPlotsReadyState(true);
      }
    });

  };

  this.addInfoPanel = function () {
    this.outputPanel.$body.find(".infoPanel").remove();
    this.infoPanel = new InfoPanel("infoPanel", "Pulse adjustment parameters", null, null, null);
    this.infoPanel.redraw = function() {

      if (currentObj.phSlidersMode == "per_der"){
        content = "<tr><td> Frequency: " + currentObj.phPlot.plotConfig.f.toFixed(6) + " Hz</td></tr>" +
                  "<tr><td> Delta fdot: " + currentObj.phPlot.plotConfig.fdot.toFixed(9) + "</td></tr>" +
                  "<tr><td> Delta fddot: " + currentObj.phPlot.plotConfig.fddot.toFixed(9) + "</td></tr>";
      } else {
        content = "<tr><td> PB (s):   " + currentObj.phPlot.plotConfig.binary_params[0].toFixed(6) + "  (" + (currentObj.phPlot.plotConfig.binary_params[0] / 86400).toFixed(6) + " d)</td></tr>" +
                  "<tr><td> A1 (l-s): " + currentObj.phPlot.plotConfig.binary_params[1].toFixed(6) + "</td></tr>" +
                  "<tr><td> T0 (MET): " + currentObj.phPlot.plotConfig.binary_params[2].toFixed(6) + "</td></tr>";
      }

      this.container.html(content);
    }
    this.infoPanel.redraw();
    this.outputPanel.$body.append(this.infoPanel.$html);
  }

  this.outputPanel.getFilters = function () {
    return currentObj.phPlot.plotConfig.filters;
  }

  //Set the selected plot configs
  this.plotConfig = plotConfig;

  this.pulseSearchAdvEnabled = false;
  this.phaseogramAdvEnabled = false;
  this.phSlidersTimeout = 25;
  this.phSlidersMode = "per_der";

  this.setTitle("Phaseogram");

  //Preapares PG toolpanel data
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Analyze');
  this.prepareTabButton(this.wfSelector.find(".styleBtn"));
  this.wfSelector.find(".styleBtn").show();
  this.toolPanel.styleContainer.removeClass("hidden");
  this.toolPanel.clearFileSelectors();
  this.updateSelectedFile(this.plotConfig, projectConfig);

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([projectConfig]);
    this.createPlots();
  }

  log("PHTabPanel ready! id: " + this.id);
  return this;
}
