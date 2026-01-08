package com.coinbase.t402.model;

import java.util.ArrayList;
import java.util.List;

/** HTTP 402 response body returned by an t402-enabled server. */
public class PaymentRequiredResponse {
    public int t402Version;
    public List<PaymentRequirements> accepts = new ArrayList<>();
    public String error;
}
