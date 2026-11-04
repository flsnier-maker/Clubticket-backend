local stockKey = KEYS[1]
local reservationKey = KEYS[2]
local requestedQty = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])
local reservationData = ARGV[3]

local currentStock = tonumber(redis.call("GET", stockKey) or "-1")

if currentStock == -1 then
  return { err = "STOCK_NOT_INITIALIZED" }
end

if currentStock < requestedQty then
  return { err = "OUT_OF_STOCK", available = currentStock }
end

redis.call("DECRBY", stockKey, requestedQty)
redis.call("SET", reservationKey, reservationData, "EX", ttlSeconds)

return { ok = true, remainingStock = currentStock - requestedQty }