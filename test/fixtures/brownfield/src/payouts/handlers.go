package payouts

func Register(r *Router) {
	r.GET("/v1/payouts", list)
	r.POST("/v1/payouts", create)
	consumer.Subscribe("kyc.verified", onVerified)
	publish("payout.settled", batch)
}
