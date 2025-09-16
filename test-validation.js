const { z } = require('zod');

// Reproduzir o schema exato da API
const FinancialType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
};

const RecurringType = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY'
};

const financialEntrySchema = z.object({
  type: z.nativeEnum(FinancialType),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().datetime('Data inválida'),
  isRecurring: z.boolean().default(false),
  recurringType: z.nativeEnum(RecurringType).nullable().optional(),
  projectId: z.string().nullable().optional(),
}).transform((data) => ({
  ...data,
  recurringType: data.recurringType || undefined,
  projectId: data.projectId || undefined,
}));

// Testar dados similares aos enviados pelo frontend
const testData = {
  type: 'INCOME',
  category: 'Vendas',
  description: 'Teste de entrada',
  amount: 100,
  date: '2024-01-15T00:00:00.000Z',
  isRecurring: false,
  recurringType: null,
  projectId: null
};

console.log('🧪 Testando validação com dados:', JSON.stringify(testData, null, 2));

try {
  const result = financialEntrySchema.parse(testData);
  console.log('✅ Validação passou! Dados validados:', JSON.stringify(result, null, 2));
} catch (error) {
  console.log('❌ Erro de validação:', error);
  if (error.issues) {
    console.log('📋 Detalhes dos erros:', JSON.stringify(error.issues, null, 2));
  }
}

// Testar com recurringType como string vazia
const testData2 = {
  ...testData,
  recurringType: ''
};

console.log('\n🧪 Testando com recurringType como string vazia:');
try {
  const result = financialEntrySchema.parse(testData2);
  console.log('✅ Validação passou!');
} catch (error) {
  console.log('❌ Erro de validação:', error.message);
  if (error.issues) {
    console.log('📋 Detalhes dos erros:', JSON.stringify(error.issues, null, 2));
  }
}