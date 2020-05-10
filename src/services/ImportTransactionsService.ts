import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import uploadConfig from '../config/upload';
import Category from '../models/Category';
import TransactionRepository from '../repositories/TransactionsRepository';

interface Request {
  filename: string;
}

type ArgList = [string, 'income' | 'outcome', string, string];

async function loadCSV(filePath: string): Promise<ArgList[]> {
  const readCSVStream = fs.createReadStream(filePath);

  const parseStream = csvParse({
    from_line: 2,
    ltrim: true,
    rtrim: true,
  });

  const parseCSV = readCSVStream.pipe(parseStream);

  const lines: ArgList[] = [];

  parseCSV.on('data', (line: ArgList) => {
    lines.push(line);
  });

  await new Promise(resolve => {
    parseCSV.on('end', resolve);
  });

  return lines;
}
class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);
    const csvFilePath = path.resolve(uploadConfig.directory, filename);

    const data = await loadCSV(csvFilePath);

    const categories = data.map(arrayOptions => arrayOptions[3]);
    const existentCategories = await categoryRepository.find({
      where: { title: In(categories) },
    });

    const existentCategoriesNames = existentCategories.map(
      category => category.title,
    );

    const newCategories: string[] = [];
    categories.forEach(category => {
      if (
        !existentCategoriesNames.includes(category) &&
        !newCategories.includes(category)
      ) {
        newCategories.push(category);
      }
    });

    const createdCategories: Category[] = newCategories.map(category => {
      return categoryRepository.create({ title: category });
    });
    await categoryRepository.save(createdCategories);

    const allCategories = [...existentCategories, ...createdCategories];
    const transactionsToSave = data.map((transactionArray: ArgList) => {
      return {
        title: transactionArray[0],
        type: transactionArray[1],
        value: Number(transactionArray[2]),
        category: allCategories.find(
          category => category.title === transactionArray[3],
        ),
      };
    });

    const transactions = transactionsToSave.map(transaction =>
      transactionRepository.create(transaction),
    );
    await transactionRepository.save(transactions);
    await fs.promises.unlink(csvFilePath);

    return transactions;
  }
}

export default ImportTransactionsService;
