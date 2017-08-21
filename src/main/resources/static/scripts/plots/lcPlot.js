//Lightcurve plot

function LcPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  PlotWithSettings.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //LC plot attributes:
  this.baselineEnabled = false;
  this.baseline_opts = {};
  this.baseline_opts.lam = { default:1000, min:1, max: 100000}; //Baseline Smoothness ranges
  this.baseline_opts.p = { default:0.01, min:0.001, max: 1}; //Baseline Asymmetry ranges
  this.baseline_opts.niter = { default:10, min:1, max: 1000}; //Baseline N iterations ranges

  this.varianceEnabled = false;
  this.variance_opts = {};
  this.variance_opts.min_counts = { default:100, min:1, max: 100000}; //Minimum number of counts for each chunk on excess variance
  this.variance_opts.min_bins = { default:100, min:1, max: 100000}; //Minimum number of time bins on excess variance
  this.variance_opts.type = "alone"; //Defines if plot only "alone" -> "Fvar Vs Count rate" or "embebbed" -> "All data Vs Time"

  //LC plot methods:
  this.addSettingsControls = function(){

    if (this.settingsPanel.find(".baseline").length == 0) {

      //Baseline controls set
      var $baseline = $('<div class="baseline">' +
                          '<h3>' +
                            'Draw baseline:' +
                            '<div class="switch-wrapper">' +
                              '<div id="baseline_switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                            '</div>' +
                          '</h3>' +
                          '<div class="baselineContainer">' +
                            '<p>Smoothness: <input id="lam_' + this.id + '" class="inputLam" type="text" name="lam_' + this.id + '" placeholder="' + this.baseline_opts.lam.default + '" value="' + this.baseline_opts.lam.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.baseline_opts.lam.min + '-' + this.baseline_opts.lam.max + '</span></p>' +
                            '<p>Asymmetry: <input id="p_' + this.id + '" class="inputP" type="text" name="p_' + this.id + '" placeholder="' + this.baseline_opts.p.default + '" value="' + this.baseline_opts.p.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.baseline_opts.p.min + '-' + this.baseline_opts.p.max + '</span></p>' +
                            '<p>Nº iterations: <input id="niter_' + this.id + '" class="inputNiter" type="text" name="niter_' + this.id + '" placeholder="' + this.baseline_opts.niter.default + '" value="' + this.baseline_opts.niter.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.baseline_opts.niter.min + '-' + this.baseline_opts.niter.max + '</span></p>' +
                            '<p style="font-size:0.8em; color:#777777;">Algorithm: Asymmetric Least Squares Smoothing (P. Eilers and H. Boelens, 2005)</p>' +
                          '</div>' +
                        '</div>');

      //Prepares baselineSwitchBox
      var baselineSwitchBox = $baseline.find("#baseline_switch_" + this.id);
      baselineSwitchBox.click( function ( event ) {
        currentObj.baselineEnabled = !currentObj.baselineEnabled;
        currentObj.onBaselineValuesChanged();
        if (currentObj.baselineEnabled) {
          $(this).switchClass("fa-plus-square", "fa-minus-square");
          currentObj.settingsPanel.find(".baselineContainer").fadeIn();
        } else {
          $(this).switchClass("fa-minus-square", "fa-plus-square");
          currentObj.settingsPanel.find(".baselineContainer").fadeOut();
        }
      });

      //Prepares input events
      $baseline.find(".baselineContainer").hide();
      $baseline.find("input").on('change', this.onBaselineValuesChanged);

      this.settingsPanel.find(".leftCol").append($baseline);


      //Long-term AGN Variability controls set
      var $variance = $('<div class="variance">' +
                          '<h3>' +
                            'Draw long-term variability:' +
                            '<div class="switch-wrapper">' +
                              '<div id="variance_switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                            '</div>' +
                          '</h3>' +
                          '<div class="varianceContainer">' +
                            '<p>Plot type:</p>' +
                            '<fieldset>' +
                              '<label for="' + this.id + '_Alone">Fvar VS Count rate</label>' +
                              '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_Alone" value="alone" ' + getCheckedState(this.variance_opts.type == "alone") + '>' +
                              '<label for="' + this.id + '_Embebbed">All data Vs Time</label>' +
                              '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_Embebbed" value="embebbed" ' + getCheckedState(this.variance_opts.type == "embebbed") + '>' +
                            '</fieldset>' +
                            '<p>Min counts for each chunk: <input id="mc_' + this.id + '" class="inputMinPhotons" type="text" name="mp_' + this.id + '" placeholder="' + this.variance_opts.min_counts.default + '" value="' + this.variance_opts.min_counts.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.variance_opts.min_counts.min + '-' + this.variance_opts.min_counts.max + '</span></p>' +
                            '<p>Min. time bins: <input id="mb_' + this.id + '" class="inputMinBins" type="text" name="mb_' + this.id + '" placeholder="' + this.variance_opts.min_bins.default + '" value="' + this.variance_opts.min_bins.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.variance_opts.min_bins.min + '-' + this.variance_opts.min_bins.max + '</span></p>' +
                            '<p style="font-size:0.8em; color:#777777;">Algorithm: Vaughan et al. 2003</p>' +
                          '</div>' +
                        '</div>');

      //Prepares baselineSwitchBox
      var varianceSwitchBox = $variance.find("#variance_switch_" + this.id);
      varianceSwitchBox.click( function ( event ) {
        currentObj.varianceEnabled = !currentObj.varianceEnabled;
        currentObj.onVarianceValuesChanged();
        if (currentObj.varianceEnabled) {
          $(this).switchClass("fa-plus-square", "fa-minus-square");
          currentObj.settingsPanel.find(".varianceContainer").fadeIn();
        } else {
          $(this).switchClass("fa-minus-square", "fa-plus-square");
          currentObj.settingsPanel.find(".varianceContainer").fadeOut();
        }
      });

      var $typeRadios = $variance.find("input[type=radio][name=" + this.id + "PlotType]")
      $typeRadios.checkboxradio();
      $variance.find("fieldset").controlgroup();
      $typeRadios.change(function() {
        currentObj.variance_opts.type = this.value;
      });

      //Prepares input events
      $variance.find(".varianceContainer").hide();
      $variance.find("input").on('change', this.onVarianceValuesChanged);

      this.settingsPanel.find(".rightCol").append($variance);

      //Send setting created event
      this.onSettingsCreated();
    }
  }

  this.onBaselineValuesChanged = function(){
    if (currentObj.baselineEnabled) {
      currentObj.plotConfig.baseline_opts.lam = getInputIntValueCropped(currentObj.settingsPanel.find(".inputLam"), currentObj.plotConfig.baseline_opts.lam, currentObj.baseline_opts.lam.min, currentObj.baseline_opts.lam.max);
      currentObj.plotConfig.baseline_opts.p = getInputFloatValueCropped(currentObj.settingsPanel.find(".inputP"), currentObj.plotConfig.baseline_opts.p, currentObj.baseline_opts.p.min, currentObj.baseline_opts.p.max);
      currentObj.plotConfig.baseline_opts.niter = getInputIntValueCropped(currentObj.settingsPanel.find(".inputNiter"), currentObj.plotConfig.baseline_opts.niter, currentObj.baseline_opts.niter.min, currentObj.baseline_opts.niter.max);
    } else {
      currentObj.disableBaseline();
    }
  }

  this.disableBaseline = function () {
    currentObj.plotConfig.baseline_opts = { niter: 0 };
  }

  this.onVarianceValuesChanged = function(){
    if (currentObj.varianceEnabled) {
      currentObj.plotConfig.variance_opts.min_counts = getInputIntValueCropped(currentObj.settingsPanel.find(".inputMinPhotons"), currentObj.plotConfig.variance_opts.min_counts, currentObj.variance_opts.min_counts.min, currentObj.variance_opts.min_counts.max);
      currentObj.plotConfig.variance_opts.min_bins = getInputIntValueCropped(currentObj.settingsPanel.find(".inputMinBins"), currentObj.plotConfig.variance_opts.min_bins, currentObj.variance_opts.min_bins.min, currentObj.variance_opts.min_bins.max);
    } else {
      currentObj.disableVariance();
    }
  }

  this.disableVariance = function () {
    currentObj.plotConfig.variance_opts = { min_counts: 0 };
  }

  this.getPlotlyConfig = function (data) {

    var plotlyConfig = null;

    if (currentObj.variance_opts.type == "embebbed"
        || (currentObj.plotConfig.variance_opts.min_counts < 1)) {

      //Shows default plot with Time as X axis
      var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );

      var dataWithGaps = this.addGapsToData(data[0].values, data[1].values, data[2].values, currentObj.plotConfig.dt * 5);

      plotlyConfig = get_plotdiv_lightcurve(dataWithGaps[0], dataWithGaps[1],
                                          [], dataWithGaps[2],
                                          (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                          currentObj.plotConfig.styles.labels[coords.x],
                                          currentObj.plotConfig.styles.labels[coords.y],
                                          currentObj.plotConfig.styles.title);

      if (data.length == 11) {
        if (data[5].values.length > 0) {
          //Lightcurve has baseline values
          plotlyConfig.data.push({
                                  type : 'scatter',
                                  showlegend : false,
                                  hoverinfo : 'none',
                                  connectgaps : false,
                                  x : data[0].values,
                                  y : data[5].values,
                                  line : {
                                          color : '#DD3333'
                                        }
                                });
        }

        if (data[6].values.length > 0) {
          //Lightcurve has excess variance values
          plotlyConfig.data.push({
                                  type : 'scatter',
                                  showlegend : false,
                                  hoverinfo : 'none',
                                  connectgaps : false,
                                  x : data[6].values,
                                  y : data[7].values,
                                  error_y : {
                                             type : 'data',
                                             array : data[8].values,
                                             visible : true
                                          },
                                  line : {
                                          color : '#3333DD'
                                        }
                                });

          plotlyConfig.data.push({
                                  type : 'scatter',
                                  showlegend : false,
                                  hoverinfo : 'none',
                                  connectgaps : false,
                                  x : data[6].values,
                                  y : data[9].values,
                                  error_y : {
                                             type : 'data',
                                             array : data[10].values,
                                             visible : true
                                          },
                                  line : {
                                          color : '#33DDDD'
                                        }
                                });
        }
      } else {
        currentObj.btnSettings.hide();
      }

      plotlyConfig = currentObj.prepareAxis(plotlyConfig);

    } else if (data.length == 11) {

      //Shows plot Fvar Vs Count Rate
      plotlyConfig = get_plotdiv_scatter_with_errors(data[7].values, data[9].values,
                                                    data[8].values, data[10].values,
                                                    "Count rate", "Fvar",
                                                    currentObj.plotConfig.styles.title + " Excess Variance");
      plotlyConfig.data[0].hoverinfo = 'x+y';                                              
      plotlyConfig.layout.xaxis.type = 'log';
      plotlyConfig.layout.xaxis.autorange = true;
      plotlyConfig.layout.yaxis.type = 'log';
      plotlyConfig.layout.yaxis.autorange = true;

    } else {
      log("ERROR on getPlotlyConfig for LcPlot id: " + this.id + ", WRONG DATA RECEIVED!");
    }

    return plotlyConfig;
  }

  this.updateMinMaxCoords = function (){
    if (this.data != null) {
      var coords = this.getSwitchedCoords( { x: 0, y: 1} );
      this.minX = Math.min.apply(null, this.data[coords.x].values);
      this.minY = Math.min.apply(null, this.data[coords.y].values);
      this.maxX = Math.max.apply(null, this.data[coords.x].values);
      this.maxY = Math.max.apply(null, this.data[coords.y].values);

      var tab = getTabForSelector(this.id);
      if (!isNull(tab) && (0 <= this.minY < this.maxY)){
        tab.updateMinMaxCountRate(this.minY, this.maxY);
      }
    }
  }

  this.getPlotDefaultTracesCount = function (){
    if (currentObj.variance_opts.type == "embebbed"
        || (currentObj.plotConfig.variance_opts.min_counts < 1)) {
      return (currentObj.data.length > 5 && currentObj.data[5].values.length > 0) ? 2 : 1;
    } else {
      return 0;
    }
  }

  this.mustPropagateAxisFilter = function (axis) {
    return (axis == 1) || this.plotConfig.styles.labels[axis].startsWith(this.plotConfig.axis[axis].column);
  }

  this.getAxisForPropagation = function (axis) {
    if (axis == 1) {
      var propagationAxis =  $.extend({}, this.plotConfig.axis[axis]);
      propagationAxis.column = "RATE";
      return propagationAxis;
    } else {
      return this.plotConfig.axis[axis];
    }
  }

  this.addGapsToData = function (times, values, errorValues, minGapTime) {
    if (!isNull(times)
        && !isNull(values)
        && times.length > 1
        && times.length == values.length){

      var gapDelay = currentObj.plotConfig.dt * 0.5;
      for (i = 1; i < times.length; i++) {

        var prevTime = times[i - 1];
        var nextTime = times[i];

        if ((nextTime - prevTime) > minGapTime) {
          times.splice(i, 0, prevTime + gapDelay);
          values.splice(i, 0, null);
          errorValues.splice(i, 0, null);
          times.splice(i + 1, 0, nextTime - gapDelay);
          values.splice(i + 1, 0, null);
          errorValues.splice(i + 1, 0, null);
        }
      }

    } else {
      log("ERROR on addGapsToData for LcPlot id: " + this.id)
    }

    return [times, values, errorValues];
  }

  //Disable BaseLine and Variance parameters:
  this.disableBaseline();
  this.disableVariance();

  log ("new LcPlot id: " + this.id);

  return this;
}
