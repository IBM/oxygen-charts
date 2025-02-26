// Internal Imports
import { PieChartModel } from "../model-pie";
import { Chart } from "../chart";
import * as Configuration from "../configuration";
import {
	ChartConfig,
	PieChartOptions
} from "../interfaces/index";
import { Tools } from "../tools";

// Components
import {
	Pie,
	// the imports below are needed because of typescript bug (error TS4029)
	Tooltip,
	Legend,
	LayoutComponent
} from "../components/index";

export class PieChart extends Chart {
	model = new PieChartModel(this.services);

	// TODO - Optimize the use of "extending"
	constructor(holder: Element, chartConfigs: ChartConfig<PieChartOptions>, extending = false) {
		super(holder, chartConfigs);

		// TODO - Optimize the use of "extending"
		if (extending) {
			return;
		}

		// Merge the default options for this chart
		// With the user provided options
		this.model.setOptions(
			Tools.merge(
				Tools.clone(Configuration.options.pieChart),
				chartConfigs.options
			)
		);

		// Initialize data, services, components etc.
		this.init(holder, chartConfigs);
	}

	getComponents() {
		// Specify what to render inside the graph-frame
		const graphFrameComponents = [
			new Pie(this.model, this.services)
		];

		// get the base chart components and export with tooltip
		const components: any[] = this.getChartComponents(graphFrameComponents);
		components.push(new Tooltip(this.model, this.services));
		return components;
	}
}
