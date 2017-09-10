//Pulse Search Plot

function PulseSearchPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  plotConfig.freq_range = [-1, -1];
  plotConfig.mode = "z_n_search";
  plotConfig.oversampling = 15;
  plotConfig.nharm = 1;
  plotConfig.nbin = 128;
  plotConfig.segment_size = 5000;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.ps_opts = {};
  this.ps_opts.oversampling = { default:15, min:1, max: 100}; //Pulse peak oversampling for Z-squared search
  this.ps_opts.nharm = { default:1, min:1, max: 100}; //Number of harmonics for Z-squared search
  this.ps_opts.nbin = { default:128, min:1, max: 2048}; //Number of bins of the folded profiles for Z-squared search
  this.ps_opts.segment_size = { default:5000, min:1, max: 100000}; //Length of the segments to be averaged in the periodogram for Z-squared search

  this.candidateFreq = -1;

  this.getPlotlyConfig = function (data) {

    var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );

    var plotlyConfig = get_plotdiv_xy(data[coords.x].values, data[coords.y].values,
                                  data[coords.x].error_values, data[coords.y].error_values,
                                  (data.length > 3) ? currentObj.getWtiRangesFromGtis(data[2].values, data[3].values, data[0].values) : [],
                                  currentObj.getLabel(coords.x),
                                  currentObj.getLabel(coords.y),
                                  currentObj.plotConfig.styles.title);

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

    //Reset the candidateFreqs array
    currentObj.candidateFreqs = [];

    if (data.length == 4) {
      if (data[2].values.length > 0) {

        //Calculates the sum of stats
        var totalStats = 0;
        for (i = 0; i < data[3].values.length; i++) {
          totalStats += data[3].values[i];
        }

        //Calculates and plots the candidate frequencies
        for (i = 0; i < data[2].values.length; i++) {
          var freq = data[2].values[i];
          var ratio = data[3].values[i] / totalStats;
          currentObj.candidateFreqs.push({ freq: freq, ratio: ratio });
          plotlyConfig.data.push(getCrossLine ([freq, freq],
                                               [currentObj.minY, currentObj.maxY],
                                               '#DD3333', 3, 'solid', ratio));
         }
      } else {
        currentObj.showWarn("No pulses found in the range of frequencies");
      }
    }

    return plotlyConfig;
  }

  log ("new PulseSearchPlot id: " + this.id);

  return this;
}
