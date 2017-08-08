import utils.dave_logger as logging
import utils.file_utils as FileUtils
import utils.dave_reader as DaveReader
import utils.filters_helper as FltHelper
import utils.exception_helper as ExHelper
from maltpynt.lcurve import main as MPlcurve
from maltpynt.fspec import main as MPfspec
from maltpynt.io import MP_FILE_EXTENSION


# get_intermediate_file: Returns the filename of the intermediate file
#
# @param: filepath: absolute filepath
#
def get_intermediate_file(filepath, target):
    try:
        stingray_object = DaveReader.get_stingray_object(filepath)
        if stingray_object:
            filename = FileUtils.get_intermediate_filename(target, filepath, MP_FILE_EXTENSION)
            if DaveReader.save_to_intermediate_file(stingray_object, filename):
                return filename
    except:
        logging.error(ExHelper.getException('get_intermediate_file'))

    return None

# bulk_analisys: Executes the bulk analisys over the files
#
# @param: filenames: array of intermediate filenames
# @param: plot_configs: array of Dave Gui Plot.getConfig
#
def bulk_analisys(filenames, plot_configs, outdir):
    try:

        results = dict()
        results["outdir"] = outdir
        results["plot_configs"] = []

        # For each plot config do a bulk analisys
        for plot_config in plot_configs:

            plot_config_outdir = "/".join([outdir, plot_config["id"]])

            dt = plot_config["dt"]
            filters = FltHelper.get_filters_clean_color_filters(plot_config["filters"])
            filters = FltHelper.apply_bin_size_to_filters(filters, dt)

            if "class" in plot_config:
                if plot_config["class"] == "LcPlot":

                    args = ['--outdir', plot_config_outdir]
                    args.extend(['--bintime', str(dt)])

                    args = add_filter_to_args(args, filters, "TIME", '--safe-interval')
                    args = add_filter_to_args(args, filters, "PI", '--pi-interval')
                    args = add_filter_to_args(args, filters, "E", '--e-interval')
                    #args = add_filter_to_args(args, filters, "PHA", '--pha-interval')
                    #args = add_filter_to_args(args, filters, "RATE", '--rate-interval')

                    args.extend(filenames)

                    logging.debug("Calling MPlcurve, args: " + str(args))

                    MPlcurve(args)

                    push_plotconfig_results(results["plot_configs"], plot_config["id"], plot_config_outdir)


                elif plot_config["class"] == "PDSPlot":

                    logging.error("PDSPlot not supported yet, still work in progress!!")

                    ''' TO MANY QUESTIONS OPENED FOR IMPLEMENT PDS ON BULK ANALYSIS
                    args = ['--outdir', plot_config_outdir]

                    args.extend(['--kind', "PDS"])
                    args.extend(['--bintime', str(dt)])

                    # Normalization: MaltPyn supports Leahy or rms, now DAVE sends leahy, frac, abs or none
                    args.extend(['--norm', str(plot_config["norm"])])

                    # Rebin: is this
                    args.extend(['--rebin', str(plot_config["norm"])])

                    args.extend(filenames)

                    MPfspec(args)

                    push_plotconfig_results(results["plot_configs"], plot_config["id"], plot_config_outdir)
                    '''

                else:
                    logging.error("PlotConfig.class not supported!!")
            else:
                logging.error("PlotConfig has no class key!!")

        return results

    except:
        logging.error(ExHelper.getException('bulk_analisys'))
        return None


def push_plotconfig_results (plot_configs, plot_id, outdir):
    plot_config_results = dict()
    plot_config_results["plotId"] = plot_id
    plot_config_results["filenames"] = FileUtils.get_files_in_dir(outdir)
    plot_configs.extend([plot_config_results])

def add_filter_to_args (args, filters, column, arg_param):
    the_filter = FltHelper.get_named_filter(filters, column)
    if the_filter:
        args.extend([arg_param, str(the_filter["from"]), str(the_filter["to"])])
    return args
