/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { PlanStep } from "pddl-workspace";

export interface PlanReportSettings {
    shouldDisplay(planStep: PlanStep): boolean;
}