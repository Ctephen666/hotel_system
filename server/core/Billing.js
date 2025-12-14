class Billing {
    constructor(roomId, pricePerNight) {
        this.roomId = roomId;
        this.pricePerNight = pricePerNight;

        this.totalAcFee = 0;    
        this.totalEnergyConsumed = 0;  

        this.acUsageDetails = []; 
    }

    /**
     * @param {number} deltaMinutes - 该风速持续的分钟数
     * @param {string} fanSpeed - low / medium / high
     * @param {number} powerRateKwhPerMin - 当前风速每分钟耗电量（kWh/分钟）
     */
    recordSegment(deltaMinutes, fanSpeed, powerRateKwhPerMin) {
        if (!deltaMinutes || deltaMinutes <= 0) return;

        // 耗电：度 = kWh/min × 分钟数
        const energy = powerRateKwhPerMin * deltaMinutes;
        this.totalEnergyConsumed += energy;

        // 计费：1元/度
        const cost = energy * 1.0;
        this.totalAcFee += cost;

        // 详单记录
        this.acUsageDetails.push({
            time: new Date().toISOString(),
            minutes: deltaMinutes.toFixed(2),
            fanSpeed,
            energy: energy.toFixed(4),
            cost: cost.toFixed(2)
        });

        return { cost, energy };
    }

    /**
     * 结账逻辑
     */
    calculateFinalBill(checkInDate, checkOutDate, deposit) {
        const dayDurationMs = 1000 * 3600 * 24;
        const days = Math.ceil((checkOutDate - checkInDate) / dayDurationMs);

        const accommodationFee = days * this.pricePerNight;
        const depositAmount = deposit || 300;
        const totalFee = accommodationFee + this.totalAcFee;

        return {
            accommodationFee: accommodationFee.toFixed(2),
            acUsageFee: this.totalAcFee.toFixed(2),
            totalFee: totalFee.toFixed(2),
            deposit: depositAmount.toFixed(2),
            finalAmount: (totalFee - depositAmount).toFixed(2),
            acUsageDetails: this.acUsageDetails
        };
    }
}

export default Billing;

