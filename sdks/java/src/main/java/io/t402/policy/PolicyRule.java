package io.t402.policy;

import java.util.function.Function;

/**
 * Custom validation rule for the policy engine.
 */
public class PolicyRule {
    private final String name;
    private final Function<PolicyContext, PolicyDecision> validate;

    public PolicyRule(String name, Function<PolicyContext, PolicyDecision> validate) {
        this.name = name;
        this.validate = validate;
    }

    public String getName() { return name; }
    public PolicyDecision evaluate(PolicyContext ctx) { return validate.apply(ctx); }
}
