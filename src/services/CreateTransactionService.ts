import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  category: string;
  type: 'income' | 'outcome';
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    // TODO

    const transactionsRepository = getCustomRepository(TransactionRepository);
    if (type === 'outcome') {
      const { total } = await transactionsRepository.getBalance();
      if (total < value) {
        throw new AppError(
          'You have insuficient founds to do this transaction',
          400,
        );
      }
    }

    const categoryRepository = getRepository(Category);
    const categoryExists = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!categoryExists) {
      const newCategory = categoryRepository.create({ title: category });
      const categoryToSave = await categoryRepository.save(newCategory);
      const transaction = transactionsRepository.create({
        title,
        value,
        type,
        category: categoryToSave,
      });
      const createdTransaction = await transactionsRepository.save(transaction);

      return createdTransaction;
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: categoryExists,
    });
    const createdTransaction = await transactionsRepository.save(transaction);
    return createdTransaction;
  }
}

export default CreateTransactionService;
