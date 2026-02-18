import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal } from 'react-native'
import type { PaymentSheetProps } from './types.js'

/**
 * A bottom-sheet modal that displays payment details and handles the payment flow.
 *
 * Shows the payment amount, network, recipient, and a pay button.
 * Displays loading spinners during signing/verification and
 * success/error states after completion.
 *
 * @example
 * ```tsx
 * import { PaymentSheet, useT402Payment } from '@t402/react-native';
 *
 * function MyScreen() {
 *   const { state, pay, reset } = useT402Payment();
 *   const [sheetVisible, setSheetVisible] = useState(false);
 *
 *   return (
 *     <>
 *       <Button title="Buy" onPress={() => setSheetVisible(true)} />
 *       <PaymentSheet
 *         visible={sheetVisible}
 *         onClose={() => { setSheetVisible(false); reset(); }}
 *         paymentRequired={state.paymentRequired}
 *         selectedRequirement={state.paymentRequired?.accepts[0]}
 *         onPay={() => pay({ url: '/api/content' })}
 *         state={state}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function PaymentSheet({
  visible,
  onClose,
  paymentRequired,
  selectedRequirement,
  onPay,
  state,
  style,
}: PaymentSheetProps) {
  const isProcessing =
    state.status === 'signing' || state.status === 'verifying' || state.status === 'loading'

  const getStatusText = (): string => {
    switch (state.status) {
      case 'loading':
        return 'Connecting...'
      case 'awaiting_payment':
        return 'Ready to pay'
      case 'signing':
        return 'Signing payment...'
      case 'verifying':
        return 'Verifying payment...'
      case 'success':
        return 'Payment successful'
      case 'error':
        return state.error?.message ?? 'Payment failed'
      default:
        return ''
    }
  }

  const formatAmount = (amount: string): string => {
    const num = Number(amount) / 1e6
    return `$${num.toFixed(num < 0.01 ? 4 : 2)}`
  }

  const truncateAddress = (address: string): string => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, style as Record<string, unknown>]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Payment Required</Text>
            <TouchableOpacity onPress={onClose} disabled={isProcessing}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Resource info */}
          {paymentRequired?.resource && (
            <View style={styles.section}>
              <Text style={styles.label}>Resource</Text>
              <Text style={styles.value}>
                {paymentRequired.resource.description ?? paymentRequired.resource.url}
              </Text>
            </View>
          )}

          {/* Payment details */}
          {selectedRequirement && (
            <View style={styles.section}>
              <View style={styles.row}>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.amount}>{formatAmount(selectedRequirement.amount)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Network</Text>
                <Text style={styles.value}>{selectedRequirement.network}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Pay to</Text>
                <Text style={styles.value}>{truncateAddress(selectedRequirement.payTo)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Scheme</Text>
                <Text style={styles.value}>{selectedRequirement.scheme}</Text>
              </View>
            </View>
          )}

          {/* Status */}
          {state.status !== 'idle' && state.status !== 'awaiting_payment' && (
            <View style={styles.statusContainer}>
              {isProcessing && <ActivityIndicator size="small" color="#007AFF" />}
              {state.status === 'success' && <Text style={styles.successIcon}>OK</Text>}
              {state.status === 'error' && <Text style={styles.errorIcon}>!</Text>}
              <Text
                style={[
                  styles.statusText,
                  state.status === 'success' && styles.successText,
                  state.status === 'error' && styles.errorText,
                ]}
              >
                {getStatusText()}
              </Text>
            </View>
          )}

          {/* Transaction hash */}
          {state.txHash && (
            <View style={styles.section}>
              <Text style={styles.label}>Transaction</Text>
              <Text style={styles.txHash}>{truncateAddress(state.txHash)}</Text>
            </View>
          )}

          {/* Pay button */}
          <TouchableOpacity
            style={[
              styles.payButton,
              isProcessing && styles.payButtonDisabled,
              state.status === 'success' && styles.payButtonSuccess,
            ]}
            onPress={onPay}
            disabled={isProcessing || state.status === 'success'}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.payButtonText}>
                {state.status === 'success'
                  ? 'Done'
                  : state.status === 'error'
                    ? 'Retry'
                    : selectedRequirement
                      ? `Pay ${formatAmount(selectedRequirement.amount)}`
                      : 'Pay'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: '#666666',
  },
  value: {
    fontSize: 14,
    color: '#000000',
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
  },
  successText: {
    color: '#34C759',
  },
  errorText: {
    color: '#FF3B30',
  },
  successIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34C759',
  },
  errorIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF3B30',
  },
  txHash: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'monospace',
  },
  payButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  payButtonSuccess: {
    backgroundColor: '#34C759',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
