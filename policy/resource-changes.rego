package terraform

import input as tfplan

#######################################################
# Policy: check for resource changes in the TF plan
#######################################################

no_changes {
	no_change_resource
	no_change_output
}

no_change_resource {
	resource_changes.create == 0
	resource_changes.update == 0
	resource_changes.delete == 0
}

no_change_output {
	output_changes.create == 0
	output_changes.update == 0
	output_changes.delete == 0
}

resource_changes := {
	"create": count_resouce_changes("create"),
	"update": count_resouce_changes("update"),
	"delete": count_resouce_changes("delete"),
}

output_changes := {
	"create": count_output_changes("create"),
	"update": count_output_changes("update"),
	"delete": count_output_changes("delete"),
}

count_resouce_changes(action) = num {
	actions := [res |
		res := tfplan.resource_changes[_]
		res.change.actions[_] == action
	]

	num := count(actions)
}

count_output_changes(action) = num {
	actions := [res |
		res := tfplan.output_changes[_]
		res.actions[_] == action
	]

	num := count(actions)
}
